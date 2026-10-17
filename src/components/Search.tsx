"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_STATE,
  isDefaultState,
  matchEntries,
  parseSearchState,
  searchUrl,
  type CategoryFilter,
  type ChapterOption,
  type SearchPayload,
  type SearchState,
} from "@/lib/search";
import SearchFilters from "@/components/SearchFilters";
import SearchResults from "@/components/SearchResults";

type Props = { payload: SearchPayload };

// The URL is the source of truth for the search (q, category, chapter), so
// a search can be bookmarked, shared, and stepped through with Back.
// replaceState while typing, so every letter isn't a history entry, and
// pushState for filter changes and the buttons, so Back undoes them.
function writeUrl(state: SearchState, mode: "push" | "replace") {
  const url = searchUrl(window.location, state);
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (url === current) return;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export default function Search({ payload }: Props) {
  const searchParams = useSearchParams();
  const chapterValues = useMemo(() => new Set(payload.chapters.map((o) => o.value)), [payload.chapters]);
  const state = useMemo(() => parseSearchState(searchParams, chapterValues), [searchParams, chapterValues]);

  // What's in the box. It can run ahead of the URL while an IME is composing.
  const [draft, setDraft] = useState(state.q);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the URL's text changes from outside (Back, Forward, a link), show it
  // in the box. Our own writes already match the box, so they're left alone.
  const [seenQ, setSeenQ] = useState(state.q);
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    if (state.q.trim() !== draft.trim()) setDraft(state.q);
  }

  const results = useMemo(() => matchEntries(payload.entries, state), [payload.entries, state]);

  function commitText(value: string) {
    writeUrl({ ...state, q: value }, "replace");
  }

  function handleDraftChange(value: string, composing: boolean) {
    setDraft(value);
    // Mid-composition text (like "がk") isn't a real search yet
    if (!composing) commitText(value);
  }

  function handleCategoryChange(category: CategoryFilter) {
    writeUrl({ ...state, q: draft, category }, "push");
  }

  function handleChapterChange(chapter: string) {
    writeUrl({ ...state, q: draft, chapter }, "push");
  }

  function handleClearText() {
    setDraft("");
    writeUrl({ ...state, q: "" }, "push");
    inputRef.current?.focus();
  }

  function handleReset() {
    setDraft("");
    writeUrl(DEFAULT_STATE, "push");
    inputRef.current?.focus();
  }

  return (
    <div className="mt-4">
      <SearchFilters
        inputRef={inputRef}
        draft={draft}
        category={state.category}
        chapter={state.chapter}
        chapters={payload.chapters}
        onDraftChange={handleDraftChange}
        onCompositionEnd={commitText}
        onCategoryChange={handleCategoryChange}
        onChapterChange={handleChapterChange}
        onClearText={handleClearText}
      />
      <SearchResults
        state={state}
        active={!isDefaultState(state)}
        results={results}
        docs={payload.docs}
        headers={payload.headers}
        onReset={handleReset}
      />
    </div>
  );
}

const noop = () => {};

// Shown in the first HTML while the search reads the URL. Same layout as the
// real controls, disabled, so nothing jumps when they take over.
export function SearchFallback({ chapters }: { chapters: ChapterOption[] }) {
  return (
    <div className="mt-4" aria-busy="true">
      <SearchFilters
        disabled
        draft=""
        category="all"
        chapter="all"
        chapters={chapters}
        onDraftChange={noop}
        onCompositionEnd={noop}
        onCategoryChange={noop}
        onChapterChange={noop}
        onClearText={noop}
      />
    </div>
  );
}
