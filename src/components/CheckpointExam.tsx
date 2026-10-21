"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CheckpointExam as Exam, CheckpointPresentation, CheckpointTextPart } from "@/types/checkpoint";
import CheckpointText from "@/components/CheckpointText";
import { ReadingHint } from "@/components/ReadingPreferences";
import {
  checkpointScore, checkpointByChapter, checkpointKey, questionScore, checkpointCoverage, checkpointAnchor,
  chooseCheckpointAnswer, selectCheckpointPart, submitCheckpointAttempt,
  retryCheckpointIncorrect, newCheckpointAttempt, createCheckpointStore,
} from "@/lib/checkpoints";

const PRIMARY = "inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50";
const SECONDARY = "inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong px-3 py-2 text-sm text-accent-text hover:bg-accent-soft disabled:opacity-50";
const percent = (correct: number, total: number) => total ? Math.round(correct / total * 100) : 0;

export default function CheckpointExam({ exam, presentation }: { exam: Exam; presentation?: CheckpointPresentation }) {
  const text = (value: string, parts?: CheckpointTextPart[]) => <CheckpointText text={value} presentation={presentation} parts={parts} />;
  const store = useMemo(() => createCheckpointStore(exam, { getStorage: () => window.localStorage, getEvents: () => window }), [exam]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { state } = snapshot;
  const [confirm, setConfirm] = useState<"submit" | "restart" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const summary = useRef<HTMLDivElement | null>(null);
  const score = checkpointScore(exam, state.answers);
  const answered = score.total - score.unanswered;
  const partIndex = exam.parts.findIndex(p => p.id === state.partId);
  const part = exam.parts[partIndex];
  const firstScore = state.firstAnswers ? checkpointScore(exam, state.firstAnswers) : null;
  // Read fragments after hydration. Old exercise and key links select the right
  // part without submitting the exam or exposing an answer.
  useEffect(() => {
    if (!snapshot.ready) return;
    let frame = 0;
    const navigate = () => {
      const target = checkpointAnchor(exam, window.location.hash);
      if (!target) return;
      store.update(state => selectCheckpointPart(exam, state, target.partId));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.getElementById(target.anchor)?.scrollIntoView({ block: "start" }));
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", navigate); };
  }, [exam, store, snapshot.ready]);

  function select(id: string) {
    setConfirm(null); store.update(state => selectCheckpointPart(exam, state, id));
  }
  function finish() {
    setConfirm(null);
    store.update(state => submitCheckpointAttempt(exam, state, new Date().toISOString()));
    setAnnouncement("Exam submitted. " + score.correct + " of " + score.total + " correct.");
    summary.current?.focus();
  }
  function retry() {
    setConfirm(null); store.update(state => retryCheckpointIncorrect(exam, state));
    setAnnouncement("Retrying mistakes and blanks. Correct answers and your original assessment are kept.");
    summary.current?.focus();
  }
  function restart() {
    setConfirm(null); store.update(state => newCheckpointAttempt(exam, state));
    setAnnouncement("A fresh full attempt has started. Earlier full-attempt scores remain in history.");
    summary.current?.focus();
  }

  if (!snapshot.ready) return <div role="status" className="mt-6 rounded-card border border-border bg-surface p-5">Loading your saved checkpoint…</div>;
  return <div className="mt-6" data-checkpoint-exam={exam.id} data-storage-key={checkpointKey(exam)}>
    <div ref={summary} tabIndex={-1} className="rounded-card border border-border bg-surface p-4 sm:p-6" aria-label="Checkpoint progress">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold">{state.submitted ? "Result: " + score.correct + " / " + score.total + " correct" : answered + " / " + score.total + " answered"}</p>
        <span className="text-sm text-muted">{state.retryRound ? "Practice retry " + state.retryRound : "Full attempt " + state.attempt}</span>
      </div>
      <progress className="mt-3 h-2 w-full accent-accent" aria-label="Questions answered" value={answered} max={score.total} />
      <p className="mt-3 text-sm leading-relaxed text-muted">{score.total} questions · {checkpointCoverage(exam).label} · {exam.focus} Work at your own pace, then submit to review.</p>
      {exam.revision > 1 && <p className="mt-2 text-xs leading-relaxed text-muted" data-checkpoint-revision>
        Revised checkpoint · Version {exam.revision}. Earlier versions stay saved separately in this browser; this version has its own answers and scores.
      </p>}
      <p role={snapshot.saved ? undefined : "status"} className="mt-2 text-xs leading-relaxed text-subtle">
        {snapshot.saved ? "Your answers and up to 10 full-attempt scores are saved in this browser." : "This browser cannot save your answers. Keep this tab open to retain this attempt."}
      </p>
    </div>

    {firstScore && state.firstAnswers && <section aria-label="Assessment results" className="mt-5 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Your assessment</h2>
      <p className="mt-3 text-lg font-medium" data-first-score>First submission: {firstScore.correct} / {firstScore.total} · {percent(firstScore.correct, firstScore.total)}%</p>
      <p className="mt-2 text-sm text-muted">{firstScore.unanswered} unanswered. This result stays fixed when you retry mistakes.</p>
      {state.retryRound > 0 && state.submitted && <p className="mt-2 text-sm" data-practice-score>Practice result: {score.correct} / {score.total} · {percent(score.correct, score.total)}%</p>}
      <p className="mt-3 text-xs leading-relaxed text-subtle">Original JLPT-style course practice. This is a raw checkpoint score, not an official JLPT result or predicted pass.</p>
      <h3 className="mt-5 font-semibold">First submission by question type</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {exam.parts.map(p => { const s = questionScore(p.questions, state.firstAnswers!); return <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-border p-3 text-sm">
          <span>{p.title}</span><span className="shrink-0 font-medium">{s.correct} / {s.total}</span>
        </li>; })}
      </ul>
      <h3 className="mt-5 font-semibold">First submission by chapter</h3>
      <p className="mt-2 text-xs text-muted">Use missed or unanswered questions to choose what to review. Each chapter has a small sample of questions.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-chapter-results>
        {checkpointByChapter(exam, state.firstAnswers).map(s => <li key={s.chapter} className="rounded-control border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Chapter {s.chapter}</span><span>{s.correct} / {s.total} · {s.unanswered} unanswered</span></div>
          <progress aria-label={"Chapter " + s.chapter + " correct"} className="mt-2 h-1.5 w-full accent-accent" value={s.correct} max={s.total} />
          {s.correct < s.total && <Link href={"/chapters/" + s.chapter} className="mt-1 inline-flex min-h-11 items-center text-sm text-accent-text underline-offset-2 hover:underline">Review Chapter {s.chapter}</Link>}
        </li>)}
      </ul>
    </section>}

    {state.history.length > 0 && <details className="mt-5 rounded-card border border-border bg-surface p-4">
      <summary className="min-h-11 cursor-pointer font-medium">Full-attempt history ({state.history.length})</summary>
      <p className="mt-2 text-xs leading-relaxed text-muted">Only the first submission of each fresh attempt is recorded. Practice retries do not add scores. The same question set is used again, so later scores can reflect familiarity as well as learning.</p>
      <ol className="mt-3 space-y-2" data-checkpoint-history>
        {[...state.history].reverse().map(h => <li key={h.attempt} className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm">
          <span>Attempt {h.attempt}: {h.correct} / {h.total} · {percent(h.correct, h.total)}%</span>
          <time dateTime={h.completedAt} className="text-xs text-muted">{new Date(h.completedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
        </li>)}
      </ol>
    </details>}

    <nav aria-label="Checkpoint parts" className={"my-5 grid grid-cols-2 gap-2 " + (exam.parts.length === 2 ? "" : exam.parts.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
      {exam.parts.map(p => <button key={p.id} type="button" onClick={() => select(p.id)} aria-controls="checkpoint-active-part" aria-current={p.id === part.id ? "step" : undefined}
        className={"min-h-20 min-w-0 rounded-control border p-3 text-left " + (p.id === part.id ? "border-accent bg-accent-soft text-foreground" : "border-border bg-surface text-muted hover:border-border-strong")}>
        <span className="block text-sm font-semibold">{p.title}</span>
        <span className="mt-1 block text-xs">{p.questions.filter(q => state.answers[q.id]).length} / {p.questions.length} answered</span>
      </button>)}
    </nav>

    <section id="checkpoint-active-part" aria-labelledby="checkpoint-part-heading">
      <h2 id="checkpoint-part-heading" lang="ja" className="text-xl font-semibold">{text(part.titleJa, presentation?.prepared?.titles[part.id])}</h2>
      {presentation?.instructionsEn[part.id] ? <div data-checkpoint-instructions className="mt-3 rounded-control border border-border bg-surface p-4">
        <p lang="ja" className="text-lg leading-loose">{text(part.instructionsJa, presentation?.prepared?.instructions[part.id])}</p>
        <p lang="en" className="mt-2 text-sm leading-relaxed text-muted">{presentation.instructionsEn[part.id]}</p>
      </div> : <p lang="ja" className="mt-2 text-lg leading-relaxed">{text(part.instructionsJa, presentation?.prepared?.instructions[part.id])}</p>}
      <ol className="mt-5 space-y-5">
        {part.questions.map((q, index) => {
          const prepared = presentation?.prepared?.questions[q.id];
          const choice = state.answers[q.id];
          const correct = choice === q.correctChoiceId;
          const locked = state.locked.includes(q.id);
          const showPassage = q.passage && part.questions[index - 1]?.passage?.id !== q.passage.id;
          const answer = q.choices.find(c => c.id === q.correctChoiceId)!;
          return <li key={q.id} id={q.id} className="min-w-0 rounded-card border border-border bg-surface p-4 sm:p-5" data-checkpoint-question={q.id}>
            {Object.entries(exam.legacyAnchors ?? {}).filter(([, target]) => target.questionId === q.id).map(([id]) => <span key={id} id={id} className="block" />)}
            {q.passage && showPassage && <h3 className="mb-3 text-sm font-semibold text-muted">Passage {part.questions.slice(0, index + 1).filter((item, i, items) => item.passage?.id !== items[i - 1]?.passage?.id).length}</h3>}
            {q.passage && showPassage && <blockquote id={"checkpoint-passage-" + q.passage.id} lang="ja" className="mb-6 whitespace-pre-line rounded-control border border-border bg-background p-4 text-xl leading-loose" data-checkpoint-passage={q.passage.id}>{text(q.passage.text, prepared?.passage)}</blockquote>}
            {state.submitted && showPassage && q.passage?.translationEn && <div className="mb-5 text-sm leading-relaxed text-muted"><ReadingHint kind="english" context={exam.title + " passage " + q.passage.id} compact>{q.passage.translationEn}</ReadingHint></div>}
            <fieldset disabled={state.submitted || locked} aria-describedby={"checkpoint-prompt-" + q.id + (q.passage ? " checkpoint-passage-" + q.passage.id : "")}>
              <legend className="mb-3 text-sm font-semibold text-muted">Question {q.number}{locked ? " · Correct answer kept" : ""}</legend>
              {q.context && <p lang="ja" className="mb-3 text-lg font-medium">{text(q.context, prepared?.context)}</p>}
              <p id={"checkpoint-prompt-" + q.id} lang="ja" className="whitespace-pre-line text-xl leading-loose sm:text-2xl" data-checkpoint-prompt>{text(q.prompt, prepared?.prompt)}</p>
              {q.composition && <div role="group" lang="ja" aria-label="Sentence to arrange" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xl leading-loose">
                <span>{text(q.composition.before, prepared?.composition?.before)}</span>
                {q.composition.orderedParts.map((_, i) => <span key={i} className={"min-w-12 border-b-2 text-center " + (i === q.composition!.starIndex ? "border-accent text-accent-text" : "border-border-strong")}>{i === q.composition!.starIndex ? "★" : "＿＿"}</span>)}
                {q.composition.after && <span>{text(q.composition.after, prepared?.composition?.after)}</span>}
              </div>}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {q.choices.map(option => <label key={option.id} className={"flex min-h-12 min-w-0 cursor-pointer items-start gap-3 rounded-control border p-3 " + (choice === option.id ? "border-accent bg-accent-soft" : "border-border bg-background/40 hover:border-border-strong")}>
                  <input type="radio" name={q.id} value={option.id} checked={choice === option.id}
                    onChange={() => { setConfirm(null); store.update(state => chooseCheckpointAnswer(exam, state, q.id, option.id)); }}
                    className="mt-1.5 size-4 shrink-0 accent-accent" />
                  <span lang="ja" className="min-w-0 break-words text-lg leading-relaxed"><span className="mr-2 text-sm text-muted">{option.id}.</span>{text(option.text, prepared?.choices[option.id])}</span>
                </label>)}
              </div>
            </fieldset>
            {state.submitted && <div className="mt-4 border-t border-border pt-4" data-checkpoint-feedback>
              <p className={"text-sm font-semibold " + (correct ? "text-green-300" : "text-rose-300")}>{correct ? "Correct" : choice ? "Incorrect" : "Unanswered"} · Answer {answer.id}: <span lang="ja">{text(answer.text, prepared?.answer)}</span></p>
              {q.completedSentence && <p lang="ja" className="mt-3 text-xl leading-loose">{text(q.completedSentence, prepared?.completedSentence)}</p>}
              <p lang="ja" className="mt-3 text-lg leading-relaxed">{text(q.explanationJa, prepared?.explanationJa)}</p>
              <div className="mt-2 text-sm leading-relaxed text-muted"><ReadingHint kind="english" context={exam.title + " question " + q.number} compact>{text(q.explanationEn, prepared?.explanationEn)}</ReadingHint></div>
              <Link href={"/chapters/" + q.source.chapter + "#" + q.source.heading} className="mt-3 inline-flex min-h-11 items-center text-sm text-accent-text underline-offset-2 hover:underline">Review Chapter {q.chapter}: {q.source.title}</Link>
              {q.source.kanjiHeading && <div><Link href={"/kanji/1#" + q.source.kanjiHeading} className="inline-flex min-h-11 items-center text-sm text-accent-text underline-offset-2 hover:underline">Review Kanji 1</Link></div>}
            </div>}
          </li>;
        })}
      </ol>
    </section>

    <div className="mt-5 flex flex-wrap justify-between gap-3" aria-label="Move between question types">
      <button type="button" className={SECONDARY} disabled={partIndex === 0} onClick={() => select(exam.parts[partIndex - 1].id)}>Previous part</button>
      <button type="button" className={SECONDARY} disabled={partIndex === exam.parts.length - 1} onClick={() => select(exam.parts[partIndex + 1].id)}>Next part</button>
    </div>
    <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
      {!state.submitted && <button type="button" className={PRIMARY} onClick={() => score.unanswered ? setConfirm("submit") : finish()}>Submit exam</button>}
      {state.submitted && score.correct < score.total && <button type="button" className={PRIMARY} onClick={retry}>Retry incorrect</button>}
      <button type="button" className={SECONDARY} onClick={() => setConfirm("restart")} disabled={answered === 0 && state.firstAnswers === null}>Start new attempt</button>
      <Link href="/checkpoints" className={SECONDARY}>All checkpoints</Link>
    </div>
    {confirm === "submit" && <div role="group" aria-label="Confirm checkpoint submission" className="mt-4 rounded-card border border-border-strong bg-surface p-4">
      <p className="text-sm">{score.unanswered} questions are unanswered. Submit for review now?</p>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={PRIMARY} onClick={finish}>Submit with unanswered questions</button><button type="button" className={SECONDARY} onClick={() => setConfirm(null)}>Keep answering</button></div>
    </div>}
    {confirm === "restart" && <div role="group" aria-label="Confirm fresh attempt" className="mt-4 rounded-card border border-border-strong bg-surface p-4">
      <p className="text-sm">Clear the current answers and start a fresh full attempt? Your previous full-attempt scores will remain in history.</p>
      <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={PRIMARY} onClick={restart}>Start fresh attempt</button><button type="button" className={SECONDARY} onClick={() => setConfirm(null)}>Keep this attempt</button></div>
    </div>}
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
  </div>;
}
