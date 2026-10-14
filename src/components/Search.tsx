"use client";

import { useMemo, useState } from "react";
import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";
import ResultCard from "@/components/ResultCard";

const data = rawData as LessonData;
const docsById = new Map(data.docs.map((doc) => [doc.n, doc]));

export default function Search() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.items.filter((item) => item.x.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search kana, romaji, or English..."
        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-lg outline-none focus:border-neutral-400"
      />

      {query && (
        <p className="mt-3 text-sm text-neutral-400">{results.length} results</p>
      )}

      <ul className="mt-3 space-y-2">
        {results.slice(0, 50).map((item, i) => (
          <ResultCard key={i} item={item} doc={docsById.get(item.d)} />
        ))}
      </ul>
    </div>
  );
}
