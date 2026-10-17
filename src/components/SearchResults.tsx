"use client";

import { useMemo, useState } from "react";
import {
  PAGE_SIZE,
  categoryLabel,
  chapterLabel,
  type SearchDoc,
  type SearchEntry,
  type SearchState,
} from "@/lib/search";
import ResultCard from "@/components/ResultCard";

type Props = {
  state: SearchState;
  active: boolean; // false when there's no text and no filter (the idle state)
  results: SearchEntry[];
  docs: SearchDoc[];
  headers: string[][];
  onReset: () => void;
};

// "gakkou" in Vocabulary, Chapter 6
function describe(state: SearchState) {
  const parts: string[] = [];
  if (state.q.trim()) parts.push(`"${state.q.trim()}"`);
  const filters: string[] = [];
  if (state.category !== "all") filters.push(categoryLabel(state.category));
  if (state.chapter !== "all") filters.push(chapterLabel(state.chapter));
  if (filters.length) parts.push(`in ${filters.join(", ")}`);
  return parts.join(" ");
}

export default function SearchResults({ state, active, results, docs, headers, onReset }: Props) {
  const docTitles = useMemo(() => new Map(docs.map((doc) => [doc.n, doc.title])), [docs]);

  // Back to the first page whenever the search changes
  const key = [state.q.trim(), state.category, state.chapter].join("\n");
  const [page, setPage] = useState({ key, limit: PAGE_SIZE });
  const limit = page.key === key ? page.limit : PAGE_SIZE;

  const count = results.length;
  const status = !active
    ? ""
    : count === 0
      ? "No results"
      : `${count.toLocaleString("en-US")} ${count === 1 ? "result" : "results"}` +
        (count > limit ? ` (showing ${limit})` : "");

  return (
    <>
      <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* Always in the page, so screen readers hear each new count */}
        <p className="text-sm text-muted" aria-live="polite">
          {status}
        </p>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-8 rounded-control px-2 text-sm text-accent-text transition-colors hover:bg-surface-raised"
          >
            Reset search
          </button>
        )}
      </div>

      {!active && (
        <p className="mt-1 text-sm text-subtle">
          Type a word in kana, romaji or English, or pick a category or chapter, to see matching entries.
        </p>
      )}

      {active && count === 0 && (
        <div className="mt-2 rounded-card border border-dashed border-border px-4 py-6 text-center">
          <p className="text-foreground">Nothing matches {describe(state)}.</p>
          <p className="mt-1 text-sm text-muted">Try fewer letters, another spelling, or a different filter.</p>
        </div>
      )}

      {count > 0 && (
        <ul className="mt-2 space-y-2">
          {results.slice(0, limit).map((entry) => (
            <ResultCard
              key={entry.id}
              entry={entry}
              docTitle={docTitles.get(entry.d)}
              header={entry.h === null ? undefined : headers[entry.h]}
              badge={state.category === "all" ? categoryLabel(entry.c) : undefined}
            />
          ))}
        </ul>
      )}

      {count > limit && (
        <button
          type="button"
          onClick={() => setPage({ key, limit: limit + PAGE_SIZE })}
          className="mt-4 min-h-11 w-full rounded-card border border-border bg-background py-3 text-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-foreground"
        >
          Show more ({count - limit} left)
        </button>
      )}
    </>
  );
}
