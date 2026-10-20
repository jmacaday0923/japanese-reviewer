"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ListeningExam as Exam } from "@/types/listening";
import { chooseListeningAnswer, createListeningStore, listeningQuestions, listeningScore, newListeningAttempt,
  retryListeningIncorrect, selectListeningSection, submitListeningAttempt } from "@/lib/listening";
import { ReadingHint } from "@/components/ReadingPreferences";
import Icon from "@/components/Icon";

const PRIMARY = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50";
const SECONDARY = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong px-3 py-2 text-sm text-accent-text hover:bg-accent-soft disabled:opacity-50";

export default function ListeningExam({ exam }: { exam: Exam }) {
  const store = useMemo(() => createListeningStore(exam, { getStorage: () => window.localStorage, getEvents: () => window }), [exam]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { state } = snapshot;
  const sectionIndex = exam.sections.findIndex(section => section.id === state.sectionId);
  const section = exam.sections[sectionIndex];
  const score = listeningScore(exam, state);
  const questions = listeningQuestions(exam);
  const answered = questions.length - score.unanswered;
  const audio = useRef<HTMLAudioElement | null>(null);
  const positions = useRef<Record<string, number>>({});
  const pendingSeek = useRef<number | null>(null);
  const [audioError, setAudioError] = useState("");
  const [confirm, setConfirm] = useState<"submit" | "restart" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const summary = useRef<HTMLDivElement | null>(null);

  function selectSection(id: string) {
    audio.current?.pause(); pendingSeek.current = null; setAudioError(""); setConfirm(null);
    store.update(state => selectListeningSection(exam, state, id));
  }
  function finish() {
    audio.current?.pause(); setConfirm(null);
    store.update(state => submitListeningAttempt(exam, state));
    setAnnouncement(`Exam submitted. ${score.correct} of ${score.total} correct.`);
    summary.current?.focus();
  }
  function retry() {
    audio.current?.pause(); setConfirm(null); setAudioError("");
    store.update(state => retryListeningIncorrect(exam, state));
    setAnnouncement("Retrying incorrect and unanswered questions. Correct answers and your first score are kept.");
    summary.current?.focus();
  }
  function restart() {
    audio.current?.pause(); positions.current = {}; pendingSeek.current = null; setConfirm(null); setAudioError("");
    store.update(state => newListeningAttempt(exam, state.attempt + 1));
    setAnnouncement("A new listening attempt has started."); summary.current?.focus();
  }
  function replay(seconds: number) {
    const player = audio.current;
    if (!player) return;
    setAudioError(""); pendingSeek.current = seconds;
    if (player.readyState >= 1) { player.currentTime = Math.min(seconds, Math.max(0, player.duration - 1)); pendingSeek.current = null; }
    void player.play().catch(() => setAudioError("Audio could not start. Try the player’s Play control or open the audio file below."));
  }

  if (!snapshot.ready) return <div className="mt-6 rounded-card border border-border bg-surface p-5" role="status">Loading your saved listening answers…</div>;
  return <div className="mt-6" data-listening-exam={exam.id}>
    <div ref={summary} tabIndex={-1} className="rounded-card border border-border bg-surface p-4 sm:p-5" aria-label="Listening progress">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{state.submitted ? `Result: ${score.correct} / ${score.total} correct` : `${answered} / ${questions.length} answered`}</p>
        <p className="text-xs text-subtle">{state.submitted ? "Answer review" : state.retryRound ? `Retry ${state.retryRound}` : "Practice attempt"}</p>
      </div>
      <progress aria-label="Questions answered" value={answered} max={questions.length} className="mt-3 h-2 w-full accent-accent" />
      <p className="mt-2 text-xs leading-relaxed text-muted">{snapshot.saved ? "Your answers are saved in this browser. Audio plays when you press Play." : "This browser cannot save your answers. Keep this tab open to retain this attempt."}</p>
      {state.firstScore && <p className="mt-2 text-sm text-muted">First attempt: {state.firstScore.correct} / {state.firstScore.total} correct{state.firstScore.unanswered ? ` · ${state.firstScore.unanswered} unanswered` : ""}</p>}
      {state.submitted && <p className="mt-3 text-xs leading-relaxed text-subtle">{exam.answerKeyNotice}</p>}
    </div>

    <nav aria-label="Listening parts" className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {exam.sections.map(part => <button key={part.id} type="button" aria-current={part.id === section.id ? "step" : undefined}
        onClick={() => selectSection(part.id)} aria-controls="listening-active-part"
        className={"min-h-16 min-w-0 rounded-control border p-3 text-left text-sm " + (part.id === section.id ? "border-accent bg-accent-soft text-foreground" : "border-border bg-surface text-muted hover:border-border-strong")}>
        <span className="block font-semibold" lang="ja">もんだい {part.number}</span>
        <span className="mt-1 block text-xs">{part.title}</span>
        <span className="mt-1 block text-xs text-subtle">{part.questions.filter(q => state.answers[q.id]).length} / {part.questions.length} answered</span>
      </button>)}
    </nav>

    <section id="listening-active-part" aria-labelledby="listening-part-heading">
      <h2 id="listening-part-heading" className="text-xl font-semibold" lang="ja">もんだい {section.number} · {section.titleJa}</h2>
      <p className="mt-2 text-[1.0625rem] leading-relaxed" lang="ja">{section.instructionsJa}</p>
      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <p id="listening-audio-label" className="mb-3 text-sm font-medium">Part {section.number} audio · {section.title}</p>
        <audio key={`${state.attempt}:${section.id}`} ref={audio} controls preload="none" src={section.audioSrc}
          aria-labelledby="listening-audio-label" className="block w-full max-w-full"
          onTimeUpdate={event => { positions.current[section.id] = event.currentTarget.currentTime; }}
          onLoadedMetadata={event => {
            const start = pendingSeek.current ?? positions.current[section.id] ?? 0;
            event.currentTarget.currentTime = Math.min(start, Math.max(0, event.currentTarget.duration - 1)); pendingSeek.current = null;
          }}
          onError={() => setAudioError("This audio could not be loaded. Try opening the audio file below.")}
        >Your browser does not support this audio player.</audio>
        <p className="mt-2 text-xs text-subtle">Listen at your own pace. You can pause, replay, and seek. The opening includes instructions and a worked example.</p>
        <a href={section.audioSrc} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs text-accent-text underline-offset-2 hover:underline">Open this part’s audio file</a>
        {audioError && <p role="alert" className="mt-2 text-sm text-rose-300">{audioError}</p>}
      </div>
      <ol className="mt-6 space-y-5">
        {section.questions.map(question => {
          const choice = state.answers[question.id];
          const locked = state.locked.includes(question.id);
          const correct = choice === question.correctChoiceId;
          return <li key={question.id} className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-5" data-listening-question={question.id}>
            <fieldset disabled={state.submitted || locked}>
              <legend className="mb-4 text-lg font-semibold" lang="ja">{question.number}ばん{locked && <span className="ml-2 text-xs font-normal text-green-300">Correct answer kept</span>}</legend>
              {question.image && <figure className="mb-4 overflow-hidden rounded-control border border-border bg-white p-2">
                <Image src={question.image.src} alt={question.image.alt} width={question.image.width} height={question.image.height}
                  unoptimized={question.image.src.endsWith(".svg")} sizes="(max-width: 768px) 90vw, 720px" className="mx-auto h-auto max-h-[42rem] w-full object-contain" />
                <figcaption className="pt-2 text-center text-xs text-slate-700"><a className="inline-flex min-h-11 items-center underline underline-offset-2" href={question.image.src} target="_blank" rel="noreferrer">View full-size picture for question {question.number}</a></figcaption>
              </figure>}
              <div className="grid gap-2 sm:grid-cols-2">
                {question.choices.map(option => <label key={option.id} className={"flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-control border p-3 text-[1.0625rem] leading-relaxed " + (choice === option.id ? "border-accent bg-accent-soft" : "border-border bg-background/40 hover:border-border-strong")}>
                  <input type="radio" name={question.id} value={option.id} checked={choice === option.id}
                    onChange={() => { setConfirm(null); store.update(state => chooseListeningAnswer(exam, state, question.id, option.id)); }}
                    className="size-4 shrink-0 accent-accent" />
                  <span className="min-w-0 break-words" lang="ja">{option.text === option.id ? option.id : <><span className="mr-2 text-sm text-subtle">{option.id}.</span>{option.text}</>}</span>
                </label>)}
              </div>
            </fieldset>
            {state.submitted && <div className="mt-4 border-t border-border pt-4" data-listening-feedback>
              <p className={"text-sm font-semibold " + (correct ? "text-green-300" : "text-rose-300")}>
                {correct ? "Correct" : choice ? "Incorrect" : "Unanswered"} · Answer {question.correctChoiceId}{!correct && choice ? ` · Your answer ${choice}` : ""}
              </p>
              <p lang="ja" className="mt-3 text-lg leading-relaxed">{question.explanationJa}</p>
              <div className="mt-3 text-sm"><ReadingHint kind="english" context={`listening part ${section.number}, question ${question.number}`} compact><span lang="en" className="text-muted">{question.explanationEn}</span></ReadingHint></div>
              <details className="mt-4 rounded-control border border-border bg-background/40 p-3">
                <summary className="cursor-pointer text-sm text-accent-text">Audio clue</summary>
                <blockquote lang="ja" className="mt-3 text-lg leading-relaxed">{question.evidenceJa}</blockquote>
                <button type="button" className={SECONDARY + " mt-3"} onClick={() => replay(question.evidenceStartSeconds)}><Icon name="headphones" className="size-4" />Replay this clue</button>
              </details>
            </div>}
          </li>;
        })}
      </ol>
    </section>

    <div className="mt-6 flex flex-wrap justify-between gap-3">
      <button type="button" className={SECONDARY} disabled={sectionIndex === 0} onClick={() => selectSection(exam.sections[sectionIndex - 1].id)}>Previous part</button>
      <button type="button" className={SECONDARY} disabled={sectionIndex === exam.sections.length - 1} onClick={() => selectSection(exam.sections[sectionIndex + 1].id)}>Next part</button>
    </div>
    <div className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap gap-3">
        {!state.submitted && <button type="button" className={PRIMARY} onClick={() => score.unanswered ? setConfirm("submit") : finish()}>Submit exam</button>}
        {state.submitted && score.correct < score.total && <button type="button" className={PRIMARY} onClick={retry}>Retry incorrect</button>}
        <button type="button" className={SECONDARY} disabled={!answered && !state.submitted && !state.retryRound} onClick={() => setConfirm("restart")}>Restart exam</button>
      </div>
      {confirm === "submit" && <div role="group" aria-label="Confirm exam submission" className="mt-4 border-t border-border pt-4">
        <p className="text-sm text-muted">{score.unanswered} questions are unanswered. They will count as incorrect in the practice result.</p>
        <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={PRIMARY} onClick={finish}>Submit with unanswered questions</button><button type="button" className={SECONDARY} onClick={() => setConfirm(null)}>Keep answering</button></div>
      </div>}
      {confirm === "restart" && <div role="group" aria-label="Confirm exam restart" className="mt-4 border-t border-border pt-4">
        <p className="text-sm text-muted">Start a new attempt and clear this attempt’s answers and first score?</p>
        <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={PRIMARY} onClick={restart}>Start a new attempt</button><button type="button" className={SECONDARY} onClick={() => setConfirm(null)}>Keep this attempt</button></div>
      </div>}
      <p className="mt-3 text-xs leading-relaxed text-subtle">Answers and clues appear after you submit. Your score counts correct questions; it is not a JLPT scaled score.</p>
    </div>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
  </div>;
}
