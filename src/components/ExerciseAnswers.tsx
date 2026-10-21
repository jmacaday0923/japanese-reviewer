"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { applyGrades, createActivity, editAnswer, gradeParticle, restartActivity, retryIncorrect, summarize } from "@/lib/exercises";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, PracticeSummary, Verdict } from "@/components/PracticeParts";
import { ReadingHint } from "@/components/ReadingPreferences";
import { normalizeWorkbook } from "@/lib/workbook";
import ExerciseText from "@/components/ExerciseText";
import type { ExerciseDisplayNode } from "@/lib/study-markup";

export type ExerciseAnswerRow = {
  id: string; number: string; accepted: string[];
  prompt: ReactNode; model: ExerciseDisplayNode[]; explanation: ExerciseDisplayNode[];
};
type Props = { heading: string; answerHeading: string; mode: "choice" | "particle" | "kana" | "self"; rows: ExerciseAnswerRow[] };

// The trusted prompt/model nodes are prepared by the server. No source datasets
// or display catalogs enter this client module. Answers stay in this open page.
export default function ExerciseAnswers({ heading, answerHeading, mode, rows }: Props) {
  const uid = useId(), root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(() => createActivity(rows.map(q => q.id)));
  const [revealed, setRevealed] = useState<string[]>([]);
  const [mounted, setMounted] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const selfCheck = mode === "self", summary = summarize(state);
  function focus(id: string) {
    setMounted(ids => ids.includes(id) ? ids : [...ids, id]);
    requestAnimationFrame(() => {
      const item = root.current?.querySelector<HTMLElement>('[data-exercise-row="' + id + '"]');
      const disclosure = item?.querySelector("details");
      if (disclosure) disclosure.open = true;
      requestAnimationFrame(() => item?.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled)')?.focus());
    });
  }
  function edit(id: string, value: string) {
    setState(s => editAnswer(s, id, value));
    setRevealed(ids => ids.filter(item => item !== id)); setNotice("");
  }
  function check(q: ExerciseAnswerRow) {
    const value = state.progress[q.id].value;
    if (!value.trim()) { setNotice("Question " + q.number + ": finish your answer first."); focus(q.id); return; }
    if (selfCheck) {
      setRevealed(ids => ids.includes(q.id) ? ids : [...ids, q.id]);
      setNotice("Question " + q.number + ": compare with the model, then record your self-check.");
    } else {
      const grade = mode === "kana" ? q.accepted.some(form => normalizeWorkbook(form) === normalizeWorkbook(value)) ? "correct" : "incorrect" : gradeParticle(q, value);
      setState(s => applyGrades(s, { [q.id]: grade }));
      setNotice("Question " + q.number + ": " + grade + ".");
    }
  }
  function enter(event: KeyboardEvent<HTMLTextAreaElement>, q: ExerciseAnswerRow) {
    if (selfCheck || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault(); check(q);
  }
  function retry() {
    const next = retryIncorrect(state);
    setState(next); setRevealed([]); setNotice("Answers needing review cleared. Your completed answers are kept.");
    const id = next.ids.find(id => next.progress[id].status === "unanswered");
    if (id) focus(id);
  }
  function restart() {
    setState(restartActivity(state)); setRevealed([]); setNotice("This activity has restarted."); focus(rows[0].id);
  }
  return <div ref={root} className="legacy-exercises not-prose" data-legacy-exercise={heading} data-grading-mode={mode}>
    <p id={uid + "-method"} className="legacy-exercise-meta">
      {rows.length} questions · {selfCheck ? "Model comparison and self-check" : "Automatically checked"} ·
      Open “Answer” for a question to begin. Reloading starts fresh.
    </p>
    <table role="table" aria-labelledby={heading} aria-describedby={uid + "-method"} className="legacy-exercise-table">
      <caption className="sr-only">Questions with interactive answers</caption>
      <thead role="rowgroup" className="sr-only"><tr role="row">
        <th role="columnheader" scope="col">#</th><th role="columnheader" scope="col">Question</th><th role="columnheader" scope="col">Your answer</th>
      </tr></thead>
      <tbody role="rowgroup">{rows.map(q => {
        const progress = state.progress[q.id], locked = progress.status === "correct";
        const open = revealed.includes(q.id) || progress.status !== "unanswered";
        const promptId = uid + "-" + q.id + "-prompt", feedbackId = uid + "-" + q.id + "-feedback";
        return <tr key={q.id} role="row" data-exercise-row={q.id}>
          <td role="cell" className="legacy-question-number">{q.number}</td>
          <td role="cell" id={promptId} className="legacy-question-prompt">{q.prompt}</td>
          <td role="cell" className="legacy-question-answer">
            <details onToggle={event => {
              if (event.currentTarget.open) setMounted(ids => ids.includes(q.id) ? ids : [...ids, q.id]);
            }}>
              <summary className="legacy-answer-toggle" aria-label={"Answer question " + q.number}>{locked ? "Answer kept" : "Answer"}</summary>
              {mounted.includes(q.id) && <div className="pt-3">
                {mode === "choice" ? <fieldset disabled={locked} aria-describedby={promptId}>
                  <legend className="text-sm font-medium">Choose the numbered option for question {q.number}</legend>
                  <div className="mt-2 flex flex-wrap gap-3">{["1", "2", "3", "4"].map(id => <label key={id} className="flex min-h-11 min-w-14 cursor-pointer items-center gap-2 rounded-control border border-border-strong px-3">
                    <input type="radio" name={uid + "-" + q.id} value={id} checked={progress.value === id} onChange={() => edit(q.id, id)} className="size-4 accent-accent" />{id}
                  </label>)}</div>
                </fieldset> : <>
                  <label htmlFor={uid + "-" + q.id} className="block text-sm font-medium">Your answer for question {q.number}</label>
                  <textarea id={uid + "-" + q.id} rows={selfCheck ? 2 : 1} value={progress.value} disabled={locked}
                    onChange={event => edit(q.id, event.target.value)} onKeyDown={event => enter(event, q)}
                    aria-describedby={promptId + (open ? " " + feedbackId : "")} aria-invalid={progress.status === "incorrect" || undefined}
                    autoCapitalize="off" autoComplete="off" spellCheck={false}
                    className="mt-2 min-h-12 w-full min-w-0 resize-y rounded-control border border-border-strong bg-background p-3 text-lg leading-relaxed disabled:opacity-75" />
                </>}
                <button type="button" disabled={locked} onClick={() => check(q)} className={PRIMARY_BUTTON + " mt-3"}>
                  {selfCheck ? "Show model answer" : "Check answer"}
                </button>
                {open && <div id={feedbackId} data-exercise-feedback className="mt-4 border-t border-border pt-3">
                  {selfCheck ? <p className="text-sm font-semibold">Model answer · Other valid answers may differ</p> : <Verdict status={progress.status as "correct" | "incorrect"} />}
                  <div className="legacy-model mt-2 text-lg leading-relaxed"><ExerciseText nodes={q.model} /></div>
                  <div className="mt-2 text-sm text-muted"><ReadingHint kind="english" context={"question " + q.number + " explanation"} compact><ExerciseText nodes={q.explanation} /></ReadingHint></div>
                  <a href={"#" + answerHeading} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent-text underline underline-offset-2">Source answer key</a>
                  {selfCheck && !locked && <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY_BUTTON} onClick={() => { setState(s => applyGrades(s, { [q.id]: "correct" })); setNotice("Self-check recorded: satisfied."); }}>I’m satisfied</button>
                    <button type="button" className={SECONDARY_BUTTON} onClick={() => { setState(s => applyGrades(s, { [q.id]: "incorrect" })); setNotice("Self-check recorded: needs review."); }}>Needs review</button>
                  </div>}
                </div>}
              </div>}
            </details>
          </td>
        </tr>;
      })}</tbody>
    </table>
    <p role="status" aria-live="polite" className="px-4 text-sm text-muted">{notice}</p>
    <div className="px-4 pb-4">
      {selfCheck ? <div className="mt-3 text-sm">
        <p data-legacy-self-summary>{summary.correct} satisfied · {summary.incorrect} need review · {summary.unanswered} not compared</p>
        <p className="mt-2 text-muted">These are your self-checks, not automatically graded results.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!summary.incorrect} onClick={retry} className={SECONDARY_BUTTON}>Retry needs review</button>
          <button type="button" onClick={restart} className={SECONDARY_BUTTON}>Restart self-check</button>
        </div>
      </div> : <PracticeSummary summary={summary} noun={["question", "questions"]} onRetry={retry} onRestart={restart} />}
    </div>
  </div>;
}
