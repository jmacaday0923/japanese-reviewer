"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { WorkbookQuestion, WorkbookSet } from "@/types/workbook";
import { ReadingHint } from "@/components/ReadingPreferences";
import { applyGrades, createActivity, editAnswer, restartActivity, retryIncorrect, summarize } from "@/lib/exercises";
import { gradeWorkbook, workbookOrder } from "@/lib/workbook";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, PracticeSummary, Verdict } from "@/components/PracticeParts";

export default function WorkbookExercises({ set }: { set: WorkbookSet }) {
  const selfCheck = set.questions.every(q => q.mode === "self");
  const [state, setState] = useState(() => createActivity(set.questions.map(q => q.id)));
  const [open, setOpen] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const summary = summarize(state);
  function focusQuestion(id: string) {
    requestAnimationFrame(() => {
      const item = root.current?.querySelector('[data-workbook-question="' + id + '"]');
      const target = item?.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled)')
        ?? item?.querySelector<HTMLElement>('[data-workbook-tiles] button:not(:disabled)')
        ?? item?.querySelector<HTMLElement>('button:not(:disabled)');
      target?.focus();
    });
  }
  function check(question: WorkbookQuestion) {
    const grade = gradeWorkbook(question, state.progress[question.id].value);
    if (grade === "blank") {
      setNotice("Question " + question.number + ": finish your answer first."); focusQuestion(question.id);
    } else if (grade === null) {
      setOpen(ids => ids.includes(question.id) ? ids : [...ids, question.id]);
      setNotice("Question " + question.number + ": compare your answer with the model, then mark your self-check.");
    } else {
      setState(s => applyGrades(s, { [question.id]: grade }));
      setNotice("Question " + question.number + ": " + grade + ".");
    }
  }
  function edit(id: string, value: string) {
    setState(s => editAnswer(s, id, value)); setOpen(ids => ids.filter(item => item !== id)); setNotice("");
  }
  function retry() {
    const next = retryIncorrect(state);
    setState(next); setOpen([]); setNotice("Mistakes cleared. Correct answers and first results are kept.");
    const id = next.ids.find(id => next.progress[id].status === "unanswered");
    if (id) focusQuestion(id);
  }
  function restart() {
    setState(restartActivity(state)); setOpen([]); setNotice("This activity has restarted."); focusQuestion(set.questions[0].id);
  }
  function enter(event: KeyboardEvent<HTMLTextAreaElement>, question: WorkbookQuestion) {
    if (question.mode === "self") return;
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault(); check(question);
  }
  return <div ref={root} className="not-prose mt-4 min-w-0" data-workbook-activity={set.id}>
    <p lang="ja" className="text-lg leading-relaxed">{set.instructionsJa}</p>
    {set.instructionsEn && <p lang="en" className="mt-2 text-sm leading-relaxed text-muted">{set.instructionsEn}</p>}
    <p className="mt-2 text-xs leading-relaxed text-muted">
      {set.questions.length} questions · Printed page {set.sourcePage} · {selfCheck ? "Self-check: several answers can be valid." : "Check answers here."} Progress stays while this page is open; reloading starts fresh.
    </p>
    {set.wordBank && <p lang="ja" className="mt-3 rounded-control border border-border bg-background p-3 text-lg leading-loose">ことば：{set.wordBank.join(" ／ ")}</p>}
    <ol className="mt-4 space-y-4" style={{ listStyle: "none", paddingLeft: 0 }}>
      {set.questions.map(q => {
        const progress = state.progress[q.id], checked = progress.status !== "unanswered";
        const revealed = open.includes(q.id), locked = progress.status === "correct";
        const order = q.mode === "order" ? workbookOrder(progress.value, q.tokens!.length) ?? [] : [];
        const promptId = uid + "-" + q.id + "-prompt", feedbackId = uid + "-" + q.id + "-feedback";
        return <li key={q.id} data-workbook-question={q.id} className="min-w-0 rounded-card border border-border bg-background/40 p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted">Question {q.number}{locked ? " · Answer kept" : ""}</p>
          <p id={promptId} lang={q.mode === "self" && set.id.endsWith("translation-practice") ? "en" : "ja"} className="mt-3 whitespace-pre-line break-words text-xl leading-loose">{q.prompt}</p>
          {q.romaji && <div className="mt-2 text-sm text-muted"><ReadingHint kind="romaji" context={set.title + " question " + q.number} compact>{q.romaji}</ReadingHint></div>}
          {q.mode === "choice" ? <fieldset disabled={locked} aria-describedby={promptId + (checked ? " " + feedbackId : "")} className="mt-4">
            <legend className="sr-only">Answer question {q.number}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.choices!.map(choice => <label key={choice.id} className={"flex min-h-12 min-w-0 cursor-pointer items-start gap-3 rounded-control border p-3 " + (progress.value === choice.id ? "border-accent bg-accent-soft" : "border-border")}>
                <input type="radio" name={uid + "-" + q.id} value={choice.id} checked={progress.value === choice.id} onChange={() => edit(q.id, choice.id)} className="mt-1.5 size-4 shrink-0 accent-accent" />
                <span lang="ja" className="min-w-0 break-words text-lg leading-relaxed">{choice.id}. {choice.text}</span>
              </label>)}
            </div>
          </fieldset> : q.mode === "order" ? <div className="mt-4" role="group" aria-label={"Arrange question " + q.number} aria-describedby={promptId}>
            <p lang="ja" className="text-lg leading-relaxed">{q.before}</p>
            <div data-workbook-chosen className="my-3 flex min-h-14 flex-wrap gap-2 rounded-control border border-border p-2" aria-label="Chosen words">
              {order.map((id, i) => <button key={id} type="button" disabled={locked} aria-label={"Remove word " + (i + 1) + ": " + q.tokens![id]} className={SECONDARY_BUTTON} onClick={() => edit(q.id, order.filter(item => item !== id).join(","))}><span lang="ja">{q.tokens![id]}</span></button>)}
            </div>
            <p lang="ja" className="text-lg">{q.after}</p>
            <div data-workbook-tiles className="mt-4 flex flex-wrap gap-2" aria-label="Available words">
              {q.tokens!.map((token, id) => <button key={id} type="button" disabled={locked || order.includes(id)} className={SECONDARY_BUTTON} onClick={() => edit(q.id, [...order, id].join(","))}><span lang="ja">{token}</span></button>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={locked || !order.length} className={SECONDARY_BUTTON} onClick={() => edit(q.id, order.slice(0, -1).join(","))}>Undo last word</button>
              <button type="button" disabled={locked || !order.length} className={SECONDARY_BUTTON} onClick={() => edit(q.id, "")}>Clear words</button>
            </div>
          </div> : <div className="mt-4">
            <label htmlFor={uid + "-" + q.id} className="block text-sm font-medium">Your answer</label>
            <textarea id={uid + "-" + q.id} value={progress.value} disabled={locked} onChange={event => edit(q.id, event.target.value)} onKeyDown={event => enter(event, q)}
              aria-describedby={promptId + (checked || revealed ? " " + feedbackId : "")} rows={q.mode === "self" ? 3 : 2} autoCapitalize="off" autoComplete="off" spellCheck={false}
              className="mt-2 min-h-12 w-full min-w-0 resize-y rounded-control border border-border-strong bg-background p-3 text-lg leading-relaxed disabled:opacity-75" />
          </div>}
          <button type="button" disabled={locked} onClick={() => check(q)} className={PRIMARY_BUTTON + " mt-4"}>{q.mode === "self" ? "Show model answer" : "Check answer"}</button>
          {(checked || revealed) && <div id={feedbackId} data-workbook-feedback className="mt-4 border-t border-border pt-4">
            {q.mode === "self" ? <p className="text-sm font-semibold">Model answer · Compare your own response</p> : <Verdict status={progress.status as "correct" | "incorrect"} />}
            <p lang="ja" className="mt-3 whitespace-pre-line break-words text-xl leading-loose">{q.model}</p>
            <p lang="ja" className="mt-3 text-lg leading-relaxed">{q.whyJa}</p>
            <div className="mt-2 text-sm text-muted"><ReadingHint kind="english" context={set.title + " explanation " + q.number} compact>{q.whyEn}</ReadingHint></div>
            {q.mode === "self" && !locked && <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => { setState(s => applyGrades(s, { [q.id]: "correct" })); setNotice("Self-check recorded: satisfied."); }}>I’m satisfied</button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => { setState(s => applyGrades(s, { [q.id]: "incorrect" })); setNotice("Self-check recorded: needs review."); }}>Needs review</button>
            </div>}
          </div>}
        </li>;
      })}
    </ol>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">{notice}</p>
    {selfCheck ? <div className="mt-5 rounded-control border border-border p-4 text-sm">
      <p data-workbook-self-summary>{summary.correct} satisfied · {summary.incorrect} need review · {summary.unanswered} not compared</p>
      <p className="mt-2 text-muted">These are your self-checks, not automatically graded results.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!summary.incorrect} onClick={retry} className={SECONDARY_BUTTON}>Retry needs review</button>
        <button type="button" onClick={restart} className={SECONDARY_BUTTON}>Restart self-check</button>
      </div>
    </div> : <PracticeSummary summary={summary} noun={["question", "questions"]} onRetry={retry} onRestart={restart} />}
  </div>;
}
