// Search helpers shared by the server data module and the client search.
// Everything here is plain functions and types: no data imports, no React,
// so it is cheap to ship to the browser and easy to test on its own.
import type { Item, LessonData } from "@/types/lesson";

// ---- Payload: what the server sends to the search ----

export type Category = Item["c"];

// One searchable entry. Only the fields the search and its result cards use.
export type SearchEntry = {
  id: number;       // position in lesson-data.json items, stable while the data stays the same
  d: number;        // document number (matches SearchDoc.n)
  a: string;        // section anchor, or "" when the entry has none
  ch: string;       // chapter: "1" to "10", or "gen", "kana", "kanji"
  c: Category;
  b: string;        // breadcrumb
  x: string;        // plain text, used for matching and display
  h: number | null; // table rows: index into SearchPayload.headers; paragraphs and list points: null
};

export type SearchDoc = { n: number; title: string };

export type ChapterOption = { value: string; label: string };

export type SearchPayload = {
  docs: SearchDoc[];
  headers: string[][];      // each distinct column header list, stored once
  chapters: ChapterOption[];
  entries: SearchEntry[];
};

// ---- Filters and URL state ----

export type CategoryFilter = Category | "all";

export const CATEGORIES: readonly { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vocab", label: "Vocabulary" },
  { value: "grammar", label: "Grammar" },
  { value: "script", label: "Kana & Kanji" },
  { value: "practice", label: "Practice" },
  { value: "answers", label: "Answers" },
];

export const PAGE_SIZE = 50;

export type SearchState = { q: string; category: CategoryFilter; chapter: string };

export const DEFAULT_STATE: SearchState = { q: "", category: "all", chapter: "all" };

// The URL parameter names: /?q=gakkou&category=vocab&chapter=6
export const PARAMS = { q: "q", category: "category", chapter: "chapter" } as const;

type ReadableParams = { get(name: string): string | null };

// Reads the search state from URL params. Unknown categories or chapters
// fall back to "all", so a mistyped link still opens a working search.
export function parseSearchState(params: ReadableParams, chapterValues: ReadonlySet<string>): SearchState {
  const category = params.get(PARAMS.category);
  const chapter = params.get(PARAMS.chapter);
  return {
    q: params.get(PARAMS.q) ?? "",
    category: CATEGORIES.some((cat) => cat.value === category) ? (category as CategoryFilter) : "all",
    chapter: chapter !== null && chapterValues.has(chapter) ? chapter : "all",
  };
}

export function isDefaultState(state: SearchState): boolean {
  return state.q.trim() === "" && state.category === "all" && state.chapter === "all";
}

// Writes the state into params, leaving every other param as it was.
// Defaults are removed, so an empty search has a clean URL.
export function writeSearchState(params: URLSearchParams, state: SearchState): void {
  const q = state.q.trim();
  if (q) params.set(PARAMS.q, q);
  else params.delete(PARAMS.q);
  if (state.category !== "all") params.set(PARAMS.category, state.category);
  else params.delete(PARAMS.category);
  if (state.chapter !== "all") params.set(PARAMS.chapter, state.chapter);
  else params.delete(PARAMS.chapter);
}

// The URL for a state, keeping the path, other params and the hash.
export function searchUrl(location: { pathname: string; search: string; hash: string }, state: SearchState): string {
  const params = new URLSearchParams(location.search);
  writeSearchState(params, state);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}

// ---- Matching ----

// Same rules as before: nothing until there is text or a filter, then a
// case-insensitive "contains" on the plain text, in data order.
export function matchEntries<T extends Pick<SearchEntry, "c" | "ch" | "x">>(entries: readonly T[], state: SearchState): T[] {
  const q = state.q.trim().toLowerCase();
  const { category, chapter } = state;
  if (!q && category === "all" && chapter === "all") return [];
  return entries.filter(
    (entry) =>
      (category === "all" || entry.c === category) &&
      (chapter === "all" || entry.ch === chapter) &&
      entry.x.toLowerCase().includes(q)
  );
}

// ---- Labels and links ----

const NAMED_CHAPTERS: Record<string, string> = { gen: "General", kana: "Kana", kanji: "Kanji" };

export function chapterLabel(value: string): string {
  return /^\d+$/.test(value) ? `Chapter ${value}` : (NAMED_CHAPTERS[value] ?? value);
}

// Numbered chapters in number order, then General, Kana and Kanji, then
// anything new in alphabetical order. Only values that appear are listed.
export function buildChapterOptions(values: Iterable<string>): ChapterOption[] {
  const unique = [...new Set(values)];
  const named = Object.keys(NAMED_CHAPTERS);
  const numbers = unique.filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b));
  const known = named.filter((v) => unique.includes(v));
  const others = unique.filter((v) => !/^\d+$/.test(v) && !named.includes(v)).sort();
  return [...numbers, ...known, ...others].map((value) => ({ value, label: chapterLabel(value) }));
}

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((cat) => cat.value === category)?.label ?? category;
}

// The lesson page, jumping to the entry's section when it has one
export function lessonHref(entry: Pick<SearchEntry, "d" | "a">): string {
  return `/lessons/${entry.d}${entry.a ? `#${entry.a}` : ""}`;
}

// ---- Building the payload (runs on the server, see search-data.ts) ----

export function buildSearchPayload(data: LessonData): SearchPayload {
  const headers: string[][] = [];
  const headerIndex = new Map<string, number>();
  const entries = data.items.map((item, id): SearchEntry => {
    let h: number | null = null;
    if (item.t === "r") {
      const key = JSON.stringify(item.hd);
      h = headerIndex.get(key) ?? null;
      if (h === null) {
        h = headers.push(item.hd) - 1;
        headerIndex.set(key, h);
      }
    }
    return { id, d: item.d, a: item.a, ch: item.ch, c: item.c, b: item.b, x: item.x, h };
  });
  return {
    docs: data.docs.map((doc) => ({ n: doc.n, title: doc.title })),
    headers,
    chapters: buildChapterOptions(data.items.map((item) => item.ch)),
    entries,
  };
}
