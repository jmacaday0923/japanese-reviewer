"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_STATE,
  isDefaultState,
  matchEntries,
  parseSearchState,
  searchUrl,
  type CategoryFilter,
  type ChapterOption,
  type SearchIndex,
  type SearchState,
} from "@/lib/search";
import SearchFilters from "@/components/SearchFilters";
import SearchResults, { SearchHint } from "@/components/SearchResults";

type Props = { chapters: ChapterOption[] }; // the chapter filter's options

// The index of every study page is one static file, loaded the first time
// the search is used (focus, hover, or a search already in the URL) and
// kept for the rest of the visit. A failed load can be tried again.
let indexRequest: Promise<SearchIndex> | null = null;
function loadIndex(): Promise<SearchIndex> {
  indexRequest ??= fetch("/search-index.json").then((response) => {
    if (!response.ok) throw new Error(`Search index: ${response.status}`);
    return response.json() as Promise<SearchIndex>;
  });
  indexRequest.catch(() => {
    indexRequest = null;
  });
  return indexRequest;
}

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

// The shortcut's label for this keyboard, read only in the browser: the
// server and hydration render no label, so the hint appears once the
// shortcut below is listening.
const noSubscribe = () => () => {};
function shortcutLabel() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K";
}

export default function Search({ chapters }: Props) {
  const searchParams = useSearchParams();
  const chapterValues = useMemo(() => new Set(chapters.map((o) => o.value)), [chapters]);
  const state = useMemo(() => parseSearchState(searchParams, chapterValues), [searchParams, chapterValues]);
  const active = !isDefaultState(state);

  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [wanted, setWanted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (index || failed || !(active || wanted)) return;
    let current = true;
    loadIndex().then(
      (loaded) => current && setIndex(loaded),
      () => current && setFailed(true)
    );
    return () => {
      current = false;
    };
  }, [index, failed, active, wanted, attempt]);
  const want = () => setWanted(true);

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

  // Cmd+K or Ctrl+K focuses the search box from anywhere on the page
  const shortcut = useSyncExternalStore(noSubscribe, shortcutLabel, () => null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.isComposing) return;
      e.preventDefault(); // Ctrl+K would otherwise open the browser's own search
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => (index ? matchEntries(index.entries, state) : []), [index, state]);

  // The URL as it is right now. useSearchParams catches up a moment after
  // each history write, so two quick changes in a row (a category, then a
  // chapter) must build on the address bar, not on the last render.
  function latest() {
    return parseSearchState(new URLSearchParams(window.location.search), chapterValues);
  }

  function commitText(value: string) {
    writeUrl({ ...latest(), q: value }, "replace");
  }

  function handleDraftChange(value: string, composing: boolean) {
    setDraft(value);
    // Mid-composition text (like "がk") isn't a real search yet
    if (!composing) commitText(value);
  }

  function handleCategoryChange(category: CategoryFilter) {
    writeUrl({ ...latest(), q: draft, category }, "push");
  }

  function handleChapterChange(chapter: string) {
    writeUrl({ ...latest(), q: draft, chapter }, "push");
  }

  function handleClearText() {
    setDraft("");
    writeUrl({ ...latest(), q: "" }, "push");
    inputRef.current?.focus();
  }

  function handleReset() {
    setDraft("");
    writeUrl(DEFAULT_STATE, "push");
    inputRef.current?.focus();
  }

  return (
    // Focus or hover anywhere in the search starts loading the index
    <div onFocus={want} onPointerEnter={want}>
      <SearchFilters
        inputRef={inputRef}
        draft={draft}
        category={state.category}
        chapter={state.chapter}
        chapters={chapters}
        shortcut={shortcut}
        onDraftChange={handleDraftChange}
        onCompositionEnd={commitText}
        onCategoryChange={handleCategoryChange}
        onChapterChange={handleChapterChange}
        onClearText={handleClearText}
      />
      <SearchResults
        state={state}
        active={active}
        loading={active && !index && !failed}
        failed={active && failed}
        results={results}
        pages={index?.pages ?? []}
        headers={index?.headers ?? []}
        onReset={handleReset}
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    </div>
  );
}

const noop = () => {};

// Shown in the first HTML while the search reads the URL. Same layout as the
// real controls, disabled, so nothing jumps when they take over.
export function SearchFallback({ chapters }: { chapters: ChapterOption[] }) {
  return (
    <div aria-busy="true">
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
      <SearchHint />
    </div>
  );
}
