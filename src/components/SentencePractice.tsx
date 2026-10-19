"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ChapterSentenceExercises } from "@/types/sentence-exercise";
import SentenceActivity from "@/components/SentenceActivity";

export default function SentencePractice({ exercises }: { exercises: ChapterSentenceExercises }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const activities = [
    { name: "Word order", questions: exercises.order },
    ...(exercises.transformations.length ? [{ name: "Transformations", questions: exercises.transformations }] : []),
  ];
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = activities.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % activities.length
      : event.key === "ArrowLeft" ? (index + last) % activities.length
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return (
    <section aria-labelledby={id + "-heading"} data-sentence-practice="" className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h3 id={id + "-heading"} className="text-lg font-semibold">Sentence building</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Build lesson examples from word and phrase tiles, or change a sentence into the requested form. Check to see the answer and explanation. Practice is kept while switching activities; reloading starts fresh.</p>
      {!exercises.transformations.length && (
        <p className="mt-2 text-sm text-muted">
          Practise transformations in{" "}
          {[1, 6, 10].map((chapter, index) => <span key={chapter}>
            {index > 0 && ", "}
            <Link href={"/chapters/" + chapter + "#exercises"} className="inline-flex min-h-11 items-center text-accent-text hover:underline">Chapter {chapter}</Link>
          </span>)}.
        </p>
      )}
      <div role="tablist" aria-label="Sentence activities" className="mt-4 flex flex-wrap gap-2">
        {activities.map((activity, index) => (
          <button key={activity.name} ref={node => { tabs.current[index] = node; }} type="button" role="tab"
            id={id + "-tab-" + index} aria-controls={id + "-panel-" + index} aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => move(event, index)}
            className={"min-h-11 rounded-full border px-4 text-sm " + (selected === index ? "border-accent bg-accent font-medium text-accent-foreground" : "border-border text-muted hover:bg-surface-raised")}>
            {activity.name} ({activity.questions.length})
          </button>
        ))}
      </div>
      {activities.map((activity, index) => (
        <div key={activity.name} role="tabpanel" id={id + "-panel-" + index} aria-labelledby={id + "-tab-" + index} hidden={selected !== index} className="mt-5">
          <SentenceActivity questions={activity.questions} />
        </div>
      ))}
    </section>
  );
}
