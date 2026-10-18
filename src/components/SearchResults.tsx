"use client";

import { useState } from "react";
import {
  PAGE_SIZE,
  categoryLabel,
  chapterLabel,
  type SearchEntry,
  type SearchPage,
  type SearchState,
} from "@/lib/search";
import ResultCard from "@/components/ResultCard";
import Icon from "@/components/Icon";

type Props = {
  state: SearchState;
  active: boolean; // false when there's no text and no filter (the idle state)
  loading: boolean; // a search is waiting for the index to arrive
  failed: boolean; // the index couldn't be loaded
  results: SearchEntry[];
  pages: SearchPage[];
  headers: string[][];
  onReset: () => void;
  onRetry: () => void;
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

export default function SearchResults({ state, active, loading, failed, results, pages, headers, onReset, onRetry }: Props) {
  // Back to the first page whenever the search changes. The stored page is
  // replaced (not just ignored), so returning to an earlier search starts at
  // 50 again instead of picking up its old "Show more" count.
  const key = [state.q.trim(), state.category, state.chapter].join("\n");
  const [page, setPage] = useState({ key, limit: PAGE_SIZE });
  if (page.key !== key) setPage({ key, limit: PAGE_SIZE });
  const limit = page.key === key ? page.limit : PAGE_SIZE;

  const count = results.length;
  const status = !active
    ? ""
    : loading
      ? "Loading search…"
      : failed
        ? "The search couldn't load."
        : count === 0
      ? "No results"
      : `${count.toLocaleString("en-US")} ${count === 1 ? "result" : "results"}` +
        (count > limit ? ` (showing ${limit})` : "");

  return (
    <>
      {/* Takes no room while idle, so the hint sits right under the filters */}
      <div className={"flex flex-wrap items-center justify-between gap-x-4 gap-y-1" + (active ? " mt-4 min-h-8" : "")}>
        {/* Always in the page, so screen readers hear each new count */}
        <p className="text-sm font-medium text-muted" aria-live="polite">
          {status}
        </p>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="min-h-8 rounded-control px-2 text-sm font-medium text-accent-text transition-colors hover:bg-surface-raised"
          >
            Reset search
          </button>
        )}
      </div>

      {!active && <SearchHint />}

      {failed && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-11 w-full rounded-card border border-border bg-background py-3 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-foreground"
        >
          Try again
        </button>
      )}

      {active && !loading && !failed && count === 0 && (
        <div className="mt-2 flex flex-col items-center rounded-card border border-dashed border-border-strong/60 px-4 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-raised text-subtle">
            <Icon name="search" />
          </span>
          <p className="mt-3 text-foreground">Nothing matches {describe(state)}.</p>
          <p className="mt-1 text-sm text-muted">Try fewer letters, another spelling, or a different filter.</p>
        </div>
      )}

      {count > 0 && (
        <ul className="mt-2 space-y-2">
          {results.slice(0, limit).map((entry) => (
            <ResultCard
              key={entry.id}
              entry={entry}
              pages={pages}
              header={entry.h === null ? undefined : headers[entry.h]}
              showCategory={state.category === "all"}
            />
          ))}
        </ul>
      )}

      {count > limit && (
        <button
          type="button"
          onClick={() => setPage({ key, limit: limit + PAGE_SIZE })}
          className="mt-3 min-h-11 w-full rounded-card border border-border bg-background py-3 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-foreground"
        >
          Show more ({count - limit} left)
        </button>
      )}
    </>
  );
}

// What the search covers, under the filters before anything is typed. The
// fallback in the first HTML shows it too, so nothing moves on load.
export function SearchHint() {
  return (
    <p className="mt-4 text-sm text-subtle">
      Search covers every chapter, kana, kanji and practice page. Browse them all below.
    </p>
  );
}
