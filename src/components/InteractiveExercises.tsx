"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ChapterExercises, ExerciseSet } from "@/types/exercise";
import CategoryTag from "@/components/CategoryTag";
import ParticleExercise from "@/components/ParticleExercise";
import VocabularyMatching from "@/components/VocabularyMatching";

// The practice panel at the top of a chapter's Exercises section: one tab
// per activity. Both activities stay mounted while you switch, so answers
// aren't lost; each chapter page has its own panel, so nothing carries over
// between chapters. Nothing is saved: reloading starts fresh.
const LABELS = {
  particles: { tab: "Particles", category: "grammar", count: (s: ExerciseSet) => s.type === "particles" ? s.questions.length : 0 },
  vocabulary: { tab: "Vocabulary", category: "vocab", count: (s: ExerciseSet) => s.type === "vocabulary" ? s.pairs.length : 0 },
} as const;

export default function InteractiveExercises({ exercises }: { exercises: ChapterExercises }) {
  const { sets } = exercises;
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  // Arrow keys, Home and End move between tabs (the usual tabs pattern)
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = sets.length - 1;
    const target =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (target === null) return;
    e.preventDefault();
    setSelected(target);
    tabs.current[target]?.focus();
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-foreground">
          Interactive practice
        </h3>
        <p className="text-xs text-subtle">Checked right here. Nothing is saved.</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Questions and explanations come from the exercises and answer key below, which stay as they are for reference.
      </p>

      <div role="tablist" aria-label="Practice activities" className="mt-4 flex flex-wrap gap-2">
        {sets.map((set, i) => {
          const label = LABELS[set.type];
          const active = i === selected;
          return (
            <button
              key={set.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={active}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                "min-h-10 rounded-full border px-4 text-sm transition-colors " +
                (active
                  ? "border-accent bg-accent font-medium text-accent-foreground"
                  : "border-border text-muted hover:border-border-strong hover:bg-surface-raised hover:text-foreground")
              }
            >
              {label.tab}
              <span className={active ? "text-accent-foreground/80" : "text-subtle"}> ({label.count(set)})</span>
            </button>
          );
        })}
      </div>

      {sets.map((set, i) => (
        <div
          key={set.id}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== selected}
          className="mt-5"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <CategoryTag category={LABELS[set.type].category} />
            <p className="text-sm font-medium text-foreground">{set.title}</p>
            <p className="w-full text-xs text-subtle">
              From{" "}
              <a href={`#${sourceOf(set).exercise}`} className="text-accent-text underline-offset-2 hover:underline">
                the exercise
              </a>{" "}
              and{" "}
              <a href={`#${sourceOf(set).answerKey}`} className="text-accent-text underline-offset-2 hover:underline">
                its answer key
              </a>
              .
            </p>
          </div>
          {set.type === "particles" ? <ParticleExercise set={set} /> : <VocabularyMatching set={set} />}
        </div>
      ))}
    </section>
  );
}

function sourceOf(set: ExerciseSet) {
  return set.type === "particles" ? set.questions[0].source : set.pairs[0].source;
}
