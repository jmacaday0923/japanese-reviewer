"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ParticleQuestion, ParticleSet } from "@/types/exercise";
import {
  applyGrades,
  createActivity,
  editAnswer,
  gradeParticle,
  restartActivity,
  retryIncorrect,
  summarize,
  type ActivityState,
} from "@/lib/exercises";
import { Explanation, PRIMARY_BUTTON, PracticeSummary, Verdict } from "@/components/PracticeParts";

// Fill in the particle, one sentence at a time. Each question is checked on
// its own; the summary below follows the whole set.
export default function ParticleExercise({ set }: { set: ParticleSet }) {
  const [state, setState] = useState(() => createActivity(set.questions.map((q) => q.id)));
  const [blank, setBlank] = useState<string | null>(null); // the question last checked while empty
  const [announcement, setAnnouncement] = useState("");
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const focusNext = useRef<string | null>(null);
  const summary = summarize(state);

  // Focus moves after Retry and Restart, once the inputs are back
  useEffect(() => {
    if (focusNext.current) {
      inputs.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  function announce(text: string) {
    // A trailing space when the text repeats, so it's read again
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));
  }

  function check(question: ParticleQuestion, number: number) {
    const grade = gradeParticle(question, state.progress[question.id].value);
    if (grade === "blank") {
      setBlank(question.id);
      announce(`Question ${number}: type a particle first.`);
      inputs.current.get(question.id)?.focus();
      return;
    }
    setBlank(null);
    const next = applyGrades(state, { [question.id]: grade });
    setState(next);
    const done = summarize(next);
    announce(
      `Question ${number}: ${grade === "correct" ? "correct" : "incorrect"}. The answer is ${question.answer}.` +
        (done.checked ? ` All checked: ${done.correct} of ${done.total} correct.` : "")
    );
  }

  function edit(id: string, value: string) {
    setState((s) => editAnswer(s, id, value));
    if (blank === id) setBlank(null);
  }

  function retry() {
    const next = retryIncorrect(state);
    focusNext.current = next.ids.find((id) => next.progress[id].status === "unanswered") ?? null;
    setState(next);
    setBlank(null);
    announce(`Retrying ${summary.incorrect} ${summary.incorrect === 1 ? "question" : "questions"}. Correct answers are kept.`);
  }

  function restart() {
    const next = restartActivity(state);
    focusNext.current = next.ids[0];
    setState(next);
    setBlank(null);
    announce("Practice restarted.");
  }

  return (
    <div>
      <p className="text-sm text-muted">
        Type the missing particle in romaji or in kana, for example <span className="text-foreground">wa</span> or{" "}
        <span lang="ja" className="text-foreground">は</span>, then check it. Enter checks too.
      </p>
      <ol className="mt-4 space-y-3">
        {set.questions.map((q) => (
          <Question
            key={q.id}
            question={q}
            number={q.source.number}
            state={state}
            showBlank={blank === q.id}
            inputRef={(el) => {
              if (el) inputs.current.set(q.id, el);
              else inputs.current.delete(q.id);
            }}
            onEdit={edit}
            onCheck={() => check(q, q.source.number)}
          />
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <PracticeSummary summary={summary} noun={["question", "questions"]} onRetry={retry} onRestart={restart} />
    </div>
  );
}

type QuestionProps = {
  question: ParticleQuestion;
  number: number;
  state: ActivityState;
  showBlank: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onEdit: (id: string, value: string) => void;
  onCheck: () => void;
};

function Question({ question, number, state, showBlank, inputRef, onEdit, onCheck }: QuestionProps) {
  const { value, status } = state.progress[question.id];
  const id = question.id;
  const [before, after] = splitPrompt(question.prompt);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Enter that confirms a Japanese IME conversion isn't a submit
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    onCheck();
  }

  return (
    <li
      className={
        "rounded-card border bg-background/40 p-4 transition-colors " +
        (status === "correct" ? "border-green-400/30" : status === "incorrect" ? "border-rose-400/30" : "border-border")
      }
    >
      <p id={`${id}-prompt`} className="break-words text-[1.0625rem] leading-relaxed text-foreground">
        <span className="mr-2 text-sm tabular-nums text-subtle">{number}.</span>
        {before}
        <span
          className={
            "inline-block min-w-12 border-b-2 px-1 text-center font-semibold " +
            (status === "correct" ? "border-green-400/60 text-green-300" : "border-border-strong")
          }
        >
          {status === "correct" ? (
            value.trim()
          ) : (
            <>
              <span className="sr-only">blank</span>
              <span aria-hidden="true">{"\u00a0"}</span>
            </>
          )}
        </span>
        {after}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-48">
          <label htmlFor={`${id}-input`} className="block text-xs font-medium text-muted">
            Your answer<span className="sr-only"> for question {number}</span>
          </label>
          <input
            id={`${id}-input`}
            ref={inputRef}
            type="text"
            value={value}
            readOnly={status === "correct"}
            onChange={(e) => onEdit(id, e.target.value)}
            onKeyDown={onKeyDown}
            aria-describedby={`${id}-prompt ${id}-feedback`}
            aria-invalid={status === "incorrect" || showBlank ? true : undefined}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={
              "mt-1 min-h-11 w-full rounded-control border bg-background px-3 text-base text-foreground transition-colors read-only:border-green-400/40 read-only:bg-transparent " +
              (status === "incorrect" ? "border-rose-400/60" : "border-border-strong focus:border-accent-text")
            }
          />
        </div>
        {status !== "correct" && (
          <button type="button" onClick={onCheck} className={PRIMARY_BUTTON + " min-h-11"}>
            Check answer<span className="sr-only"> {number}</span>
          </button>
        )}
      </div>

      <div id={`${id}-feedback`} className="mt-3 empty:hidden">
        {showBlank && (
          <p className="text-sm font-medium text-amber-300">
            Type a particle first, such as wa or <span lang="ja">は</span>, then check.
          </p>
        )}
        {status !== "unanswered" && (
          <>
            <p className="text-sm">
              <Verdict status={status} />
              {status === "incorrect" && <span className="text-muted"> You wrote “{value.trim()}”.</span>}
            </p>
            <Explanation>
              <p>
                <span className="text-subtle">Answer: </span>
                <span className="font-medium text-foreground">{question.answer}</span>
              </p>
              <p>
                <span className="text-subtle">Why: </span>
                {question.why}
              </p>
            </Explanation>
          </>
        )}
      </div>
    </li>
  );
}

// "watashi ____ kenshuusei desu." into the text before and after the blank
function splitPrompt(prompt: string): [string, string] {
  const i = prompt.indexOf("____");
  // The source's own spacing stays: "desu ____." keeps the full stop right after the blank
  return i === -1 ? [prompt + " ", ""] : [prompt.slice(0, i), prompt.slice(i + 4)];
}
