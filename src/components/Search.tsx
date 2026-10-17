"use client";

import { useMemo, useState } from "react";
import rawData from "@/data/lesson-data.json";
import type { Item, LessonData } from "@/types/lesson";
import ResultCard from "@/components/ResultCard";

const data = rawData as LessonData;
const docsById = new Map(data.docs.map((doc) => [doc.n, doc]));

// The filter chips: a value from Item["c"], or "all"
type Category = Item["c"] | "all";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vocab", label: "Vocabulary" },
  { value: "grammar", label: "Grammar" },
  { value: "script", label: "Kana & Kanji" },
  { value: "practice", label: "Practice" },
  { value: "answers", label: "Answers" },
];

const CHAPTERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const PAGE_SIZE = 50;

export default function Search() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [chapter, setChapter] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category === "all" && chapter === "all") return [];
    return data.items.filter(
      (item) =>
        (category === "all" || item.c === category) &&
        (chapter === "all" || item.ch === chapter) &&
        item.x.toLowerCase().includes(q)
    );
  }, [query, category, chapter]);

  const showing = query.trim() !== "" || category !== "all" || chapter !== "all";

  return (
    <div className="mt-4">
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
        placeholder="Search kana, romaji, or English..."
        aria-label="Search lessons"
        className="w-full rounded-card border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-subtle transition-colors focus:border-accent"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setCategory(cat.value); setLimit(PAGE_SIZE); }}
            type="button"
            aria-pressed={category === cat.value}
            className={
              "min-h-10 rounded-full border px-4 text-sm transition-colors " +
              (category === cat.value
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-border bg-background text-muted hover:border-border-strong hover:text-foreground")
            }
          >
            {cat.label}
          </button>
        ))}
        <div className="relative">
          <select
            value={chapter}
            onChange={(e) => { setChapter(e.target.value); setLimit(PAGE_SIZE); }}
            aria-label="Filter by chapter"
            className="min-h-10 appearance-none rounded-full border border-border bg-background pl-4 pr-9 text-sm text-muted transition-colors hover:border-border-strong"
          >
            <option value="all">All chapters</option>
            {CHAPTERS.map((ch) => (
              <option key={ch} value={ch}>
                Chapter {ch}
              </option>
            ))}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle">
            <path d="M6 8l4 4 4-4" />
          </svg>
        </div>
      </div>

      {showing && (
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {results.length} results
          {results.length > limit && ` (showing ${limit})`}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {results.slice(0, limit).map((item, i) => (
          <ResultCard key={i} item={item} doc={docsById.get(item.d)} />
        ))}
      </ul>

      {results.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE_SIZE)}
          className="mt-4 min-h-11 w-full rounded-card border border-border bg-background py-3 text-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-foreground"
        >
          Show more ({results.length - limit} left)
        </button>
      )}
    </div>
  );
}
