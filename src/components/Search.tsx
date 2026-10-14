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
const CHAPTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function Search() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [chapter, setChapter] = useState("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category === "all" && chapter === "all") return [];
    return data.items.filter(
      (item) =>
        (category === "all" || item.c === category) &&
        (chapter === "all" || item.ch === chapter) &&
        item.x.toLowerCase().includes(q),
    );
  }, [query, category, chapter]);

  const showing =
    query.trim() !== "" || category !== "all" || chapter !== "all";

  return (
    <div className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search kana, romaji, or English..."
        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-lg outline-none focus:border-neutral-400"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={
              "rounded-full px-3 py-1 text-sm border " +
              (category === cat.value
                ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                : "border-neutral-700 text-neutral-300 hover:border-neutral-400")
            }
          >
            {cat.label}
          </button>
        ))}
        <select
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          className="rounded-full px-3 py-1 text-sm border border-neutral-700 bg-neutral-900 text-neutral-300"
        >
          <option value="all">All chapters</option>
          {CHAPTERS.map((ch) => (
            <option key={ch} value={ch}>
              Chapter {ch}
            </option>
          ))}
        </select>
      </div>

      {showing && (
        <p className="mt-3 text-sm text-neutral-400">
          {results.length} results
          {results.length > 50 && " (showing the first 50)"}
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {results.slice(0, 50).map((item, i) => (
          <ResultCard key={i} item={item} doc={docsById.get(item.d)} />
        ))}
      </ul>
    </div>
  );
}
