"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabularyPair, VocabularySet } from "@/types/exercise";
import {
  applyGrades,
  createActivity,
  editAnswer,
  gradePair,
  restartActivity,
  retryIncorrect,
  stableShuffle,
  summarize,
  vocabularyRounds,
  type Grade,
} from "@/lib/exercises";
import StudyText from "@/components/StudyText";
import { ReadingHint } from "@/components/ReadingPreferences";
import Icon from "@/components/Icon";
import { Explanation, PRIMARY_BUTTON, PracticeSummary, Verdict } from "@/components/PracticeParts";

// Match each Japanese word to its English meaning with a menu: works with a
// keyboard, a mouse and touch, no dragging. Five words per round, and each
// menu offers all five meanings of its round, even ones already matched, so
// the last answers can't be worked out by elimination.
export default function VocabularyMatching({ set }: { set: VocabularySet }) {
  const [state, setState] = useState(() => createActivity(set.pairs.map((p) => p.id)));
  const [message, setMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const selects = useRef(new Map<string, HTMLSelectElement>());
  const focusNext = useRef<string | null>(null);
  const summary = summarize(state);

  // Each round's meanings in a shuffled order that stays put for the whole
  // attempt (retries included) and is the same on the server and in the
  // browser. Restart starts a new attempt with a new order.
  const rounds = useMemo(
    () =>
      vocabularyRounds(set.pairs).map((pairs, r) => ({
        pairs,
        options: stableShuffle(pairs, `${set.id}:${state.attempt}:${r}`),
      })),
    [set, state.attempt]
  );

  useEffect(() => {
    if (focusNext.current) {
      selects.current.get(focusNext.current)?.focus();
      focusNext.current = null;
    }
  });

  function announce(text: string) {
    setAnnouncement((previous) => (previous === text ? `${text} ` : text));
  }

  function checkAll() {
    const grades: Record<string, Grade> = {};
    for (const pair of set.pairs) {
      const { status, value } = state.progress[pair.id];
      if (status !== "correct") grades[pair.id] = gradePair(pair, value);
    }
    const graded = Object.values(grades).filter((g) => g !== "blank").length;
    if (graded === 0) {
      setMessage("Choose a meaning for at least one word, then check.");
      announce("Choose a meaning for at least one word, then check.");
      return;
    }
    const next = applyGrades(state, grades);
    setState(next);
    const done = summarize(next);
    const left = done.unanswered;
    setMessage(left > 0 ? `${left} ${left === 1 ? "word still needs" : "words still need"} a meaning.` : null);
    announce(
      `${done.correct} of ${done.total} correct, ${done.incorrect} incorrect` +
        (left > 0 ? `, ${left} not answered yet.` : ".")
    );
  }

  function choose(id: string, value: string) {
    setState((s) => editAnswer(s, id, value));
    setMessage(null);
  }

  function retry() {
    const next = retryIncorrect(state);
    focusNext.current = next.ids.find((id) => next.progress[id].status === "unanswered") ?? null;
    setState(next);
    setMessage(null);
    announce(`Retrying ${summary.incorrect} ${summary.incorrect === 1 ? "word" : "words"}. Correct matches are kept.`);
  }

  function restart() {
    const next = restartActivity(state);
    focusNext.current = next.ids[0];
    setState(next);
    setMessage(null);
    announce("Practice restarted.");
  }

  const open = set.pairs.some((p) => state.progress[p.id].status !== "correct");

  return (
    <div>
      <p className="text-sm text-muted">
        Choose the English meaning of each Japanese word, then check your answers.
      </p>

      {rounds.map((round, r) => (
        <fieldset key={r} className="mt-5">
          <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">
            Round {r + 1} of {rounds.length}
          </legend>
          <ul className="mt-2 space-y-2">
            {round.pairs.map((pair) => (
              <PairRow
                key={pair.id}
                pair={pair}
                options={round.options}
                value={state.progress[pair.id].value}
                status={state.progress[pair.id].status}
                selectRef={(el) => {
                  if (el) selects.current.set(pair.id, el);
                  else selects.current.delete(pair.id);
                }}
                onChoose={choose}
              />
            ))}
          </ul>
        </fieldset>
      ))}

      {open && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={checkAll} className={PRIMARY_BUTTON + " min-h-11"}>
            Check answers
          </button>
          {message && <p className="text-sm font-medium text-amber-300">{message}</p>}
        </div>
      )}

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <PracticeSummary summary={summary} noun={["word", "words"]} onRetry={retry} onRestart={restart} />
    </div>
  );
}

type RowProps = {
  pair: VocabularyPair;
  options: VocabularyPair[];
  value: string; // the chosen pair's id, or ""
  status: "unanswered" | "correct" | "incorrect";
  selectRef: (el: HTMLSelectElement | null) => void;
  onChoose: (id: string, value: string) => void;
};

function PairRow({ pair, options, value, status, selectRef, onChoose }: RowProps) {
  const selectId = `${pair.id}-select`;
  const chosen = options.find((o) => o.id === value);

  return (
    <li
      className={
        "rounded-card border bg-background/40 px-4 py-3 " +
        (status === "correct" ? "border-green-400/30" : status === "incorrect" ? "border-rose-400/30" : "border-border")
      }
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center sm:gap-4">
        <div className="min-w-0 break-words"><label htmlFor={selectId}>
          <span className="sr-only">Meaning of </span>
          <span className="font-medium text-foreground">{pair.display?.japanese?.primary ?? pair.kana ?? pair.japanese}</span>
          {pair.kana && pair.kana !== pair.display?.japanese?.primary && (
            <span lang="ja" className="ml-2 inline-block text-muted [word-break:keep-all]">
              {pair.kana}
            </span>
          )}
        </label>
        <p className="mt-1 text-sm"><ReadingHint kind="romaji" context={"this vocabulary word"} compact>{pair.japanese}</ReadingHint></p></div>
        {status === "correct" ? (
          // Matched: shown as text, so it stays put through retries
          <p id={selectId} className="flex min-h-11 items-center gap-2 text-foreground">
            <Icon name="check" className="size-4 text-green-300" />
            {chosen?.english}
          </p>
        ) : (
          <div className="relative">
            <select
              id={selectId}
              ref={selectRef}
              value={value}
              onChange={(e) => onChoose(pair.id, e.target.value)}
              aria-describedby={`${pair.id}-feedback`}
              aria-invalid={status === "incorrect" ? true : undefined}
              className={
                "min-h-11 w-full appearance-none rounded-control border bg-background pl-3 pr-10 text-sm transition-colors hover:bg-surface-raised " +
                (status === "incorrect" ? "border-rose-400/60 " : "border-border-strong ") +
                (value ? "text-foreground" : "text-muted")
              }
            >
              <option value="">Choose a meaning…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.english}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            />
          </div>
        )}
      </div>

      <div id={`${pair.id}-feedback`} className="empty:hidden">
        {status !== "unanswered" && (
          <div className="mt-2">
            <p className="text-sm">
              <Verdict status={status} />
              {status === "incorrect" && chosen && <span className="text-muted"> You chose “{chosen.english}”.</span>}
            </p>
            <Explanation>
              <p>
                <span className="text-subtle">Why: </span>
                <StudyText display={pair.display?.why ?? { primary: pair.why }} context="this vocabulary explanation" />
              </p>
            </Explanation>
          </div>
        )}
      </div>
    </li>
  );
}
