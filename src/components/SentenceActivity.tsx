"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { SentenceQuestion, WordOrderQuestion } from "@/types/sentence-exercise";
import { applyGrades, createActivity, editAnswer, restartActivity, retryIncorrect, stableShuffle, summarize } from "@/lib/exercises";
import { gradeTransformation, gradeWordOrder, modelSentence, tokenOrder } from "@/lib/sentence-exercises";
import { Explanation, PracticeSummary, PRIMARY_BUTTON, SECONDARY_BUTTON, Verdict } from "@/components/PracticeParts";
import { ReadingHint } from "@/components/ReadingPreferences";

export default function SentenceActivity({ questions }: { questions: SentenceQuestion[] }) {
  const [state, setState] = useState(() => createActivity(questions.map(question => question.id)));
  const [blank, setBlank] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const nextFocus = useRef<string | null>(null);
  const summary = summarize(state);

  useEffect(() => {
    if (nextFocus.current) {
      root.current?.querySelector<HTMLElement>(nextFocus.current)?.focus();
      nextFocus.current = null;
    }
  });

  function edit(id: string, value: string) {
    setState(previous => editAnswer(previous, id, value));
    if (blank === id) setBlank(null);
  }
  function focusAnswer(question: SentenceQuestion) {
    nextFocus.current = question.type === "order" ? "#" + question.id + "-bank button:not([disabled])" : "#" + question.id + "-input";
  }
  function check(question: SentenceQuestion, number: number) {
    if (state.progress[question.id].status === "correct") return;
    const value = state.progress[question.id].value;
    const grade = question.type === "order" ? gradeWordOrder(question, value) : gradeTransformation(question, value);
    if (grade === "blank") {
      setBlank(question.id); focusAnswer(question);
      if (nextFocus.current) root.current?.querySelector<HTMLElement>(nextFocus.current)?.focus();
      setAnnouncement("Question " + number + ": " + (question.type === "order" ? "use every tile before checking." : "type an answer before checking."));
      return;
    }
    setBlank(null);
    setState(previous => applyGrades(previous, { [question.id]: grade }));
    nextFocus.current = "#" + question.id + "-feedback";
    setAnnouncement("Question " + number + ": " + grade + ". The model answer and explanation are available.");
  }
  function retry() {
    const next = retryIncorrect(state);
    const question = questions.find(item => next.progress[item.id].status === "unanswered");
    if (question) focusAnswer(question);
    setState(next); setBlank(null); setAnnouncement("Retrying incorrect answers. Correct answers and your first score are kept.");
  }
  function restart() {
    setState(restartActivity(state)); setBlank(null);
    if (questions[0]) focusAnswer(questions[0]);
    setAnnouncement("Sentence practice restarted.");
  }

  return (
    <div ref={root} className="[&_button]:min-h-11">
      {questions[0]?.type === "order" && <p className="text-sm leading-relaxed text-muted">Arrange every tile to match the lesson&apos;s sentence. Other natural word orders may be possible; this activity checks the lesson order. Select a chosen tile to return it to the bank.</p>}
      {questions[0]?.type === "transform" && <p className="text-sm leading-relaxed text-muted">Type the requested form in kana or romaji from the lesson. Keep the subject, meaning and tense unless the task asks you to change them.</p>}
      <ol className="mt-4 space-y-4">
        {questions.map((question, index) => {
          const progress = state.progress[question.id];
          const correct = progress.status === "correct";
          const example = question.type === "order" ? question.example : question.original;
          const answer = question.type === "order" ? question.example : question.answer;
          const task = question.type === "order" ? "Build the sentence"
            : question.change === "negative" ? "Change to negative; keep the tense and speech style"
            : "Change from polite to casual; keep the meaning and tense";
          function inputKey(event: KeyboardEvent<HTMLInputElement>) {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.preventDefault(); check(question, index + 1);
          }
          return (
            <li key={question.id} data-sentence-question={question.id}
              className={"min-w-0 rounded-card border bg-background/40 p-4 " + (correct ? "border-green-400/30" : progress.status === "incorrect" ? "border-rose-400/40" : "border-border")}>
              <h4 id={question.id + "-prompt"} className="text-sm font-semibold text-foreground">Question {index + 1} · {task}</h4>
              {question.type === "order" ? (
                <p className="mt-3 text-sm leading-relaxed text-muted"><span className="font-medium">Meaning: </span>{example.english}</p>
              ) : (
                <div className="mt-3">
                  <p lang="ja" className="reading-japanese break-words">{example.japanese}</p>
                  <p className="mt-2 text-sm text-muted"><ReadingHint kind="english" context={"the original sentence in question " + (index + 1)}>{example.english}</ReadingHint></p>
                </div>
              )}

              {question.type === "order" ? (
                <OrderInput question={question} number={index + 1} value={progress.value} locked={correct} attempt={state.attempt} onChange={value => edit(question.id, value)} />
              ) : (
                <div className="mt-4">
                  <label htmlFor={question.id + "-input"} className="block text-sm font-medium text-muted">Your answer for question {index + 1}</label>
                  <input id={question.id + "-input"} type="text" lang="ja" value={progress.value} readOnly={correct}
                    onChange={event => edit(question.id, event.target.value)} onKeyDown={inputKey}
                    aria-describedby={question.id + "-prompt " + question.id + "-feedback"} aria-invalid={progress.status === "incorrect" || blank === question.id ? true : undefined}
                    autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    placeholder="Kana or romaji"
                    className="mt-2 min-h-12 w-full rounded-control border border-border-strong bg-background px-3 py-2 text-lg read-only:border-green-400/40" />
                </div>
              )}

              <button type="button" disabled={correct} onClick={() => check(question, index + 1)} className={PRIMARY_BUTTON + " mt-4"}>Check answer {index + 1}</button>
              <div id={question.id + "-feedback"} tabIndex={-1} className="mt-3 rounded-control empty:hidden focus-visible:outline-2 focus-visible:outline-accent-text">
                {blank === question.id && <p className="text-sm text-amber-300">{question.type === "order" ? "Use every tile before checking." : "Type an answer before checking."}</p>}
                {progress.status !== "unanswered" && <>
                  <Verdict status={progress.status} />
                  <Explanation>
                    <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Model answer</p>
                    <p lang="ja" className="reading-japanese break-words">{modelSentence(answer.japanese)}</p>
                    <p><ReadingHint kind="romaji" context={"the answer to question " + (index + 1)}>{modelSentence(answer.romaji)}</ReadingHint></p>
                    <p><ReadingHint kind="english" context={"the answer to question " + (index + 1)}>{answer.english}</ReadingHint></p>
                    <p className="break-words"><span className="font-medium text-foreground">Why: </span>{question.why}</p>
                    {question.type === "transform" && /[（(]/u.test(question.answer.japanese) && <p>The lesson also permits omitting the particle shown in brackets.</p>}
                    <a href={"#" + answer.source.heading} className="inline-flex min-h-11 items-center text-accent-text hover:underline">Review the lesson explanation →</a>
                  </Explanation>
                </>}
              </div>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <PracticeSummary summary={summary} noun={["question", "questions"]} onRetry={retry} onRestart={restart} />
    </div>
  );
}

function OrderInput({ question, number, value, locked, attempt, onChange }: {
  question: WordOrderQuestion; number: number; value: string; locked: boolean; attempt: number; onChange: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<"bank" | "chosen" | null>(null);
  const selected = tokenOrder(value, question.tokens.length) ?? [];
  const bank = stableShuffle(question.tokens.map((text, id) => ({ text, id })), question.id + ":" + attempt);
  useEffect(() => {
    if (!focusNext.current) return;
    const preferred = focusNext.current === "bank" ? "[data-tile-bank] button:not([disabled])" : "[data-chosen-tiles] button:last-of-type";
    const node = root.current?.querySelector<HTMLElement>(preferred) ?? root.current?.querySelector<HTMLElement>("[data-chosen-tiles] button, [data-tile-bank] button:not([disabled])");
    node?.focus(); focusNext.current = null;
  }, [value, locked]);
  function change(ids: number[], focus: "bank" | "chosen") {
    focusNext.current = focus; onChange(ids.join(","));
  }
  return (
    <div ref={root} className="mt-4">
      <div role="group" aria-label={"Your sentence for question " + number} data-chosen-tiles=""
        className="flex min-h-20 min-w-0 flex-wrap content-start gap-2 rounded-control border border-dashed border-border-strong p-3">
        {selected.length === 0 && <p className="self-center text-sm text-subtle">Choose tiles to build your sentence.</p>}
        {selected.map((id, index) => (
          <button key={id} type="button" lang="ja" disabled={locked}
            aria-label={"Remove " + question.tokens[id] + " (position " + (index + 1) + ")"}
            onClick={() => change(selected.filter(item => item !== id), "chosen")}
            className="max-w-full break-words rounded-control border border-accent-text bg-accent-soft px-3 py-2 text-xl text-foreground disabled:opacity-70">
            {question.tokens[id]}
          </button>
        ))}
      </div>
      <div id={question.id + "-bank"} role="group" aria-label={"Available tiles for question " + number} data-tile-bank="" className="mt-3 flex min-w-0 flex-wrap gap-2">
        {bank.map((tile, index) => (
          <button key={tile.id} type="button" lang="ja" data-token-id={tile.id} disabled={locked || selected.includes(tile.id)}
            aria-label={"Add " + tile.text + " (choice " + (index + 1) + ")"}
            onClick={() => change([...selected, tile.id], "bank")}
            className="max-w-full break-words rounded-control border border-border-strong bg-surface px-3 py-2 text-xl hover:bg-surface-raised disabled:opacity-40">
            {tile.text}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={locked || selected.length === 0} onClick={() => change(selected.slice(0, -1), "bank")} className={SECONDARY_BUTTON}>Undo last tile</button>
        <button type="button" disabled={locked || selected.length === 0} onClick={() => change([], "bank")} className={SECONDARY_BUTTON}>Clear sentence</button>
      </div>
    </div>
  );
}
