// Search helpers shared by the server data module and the client search.
// Everything here is plain functions and types: no data imports, no React,
// so it is cheap to ship to the browser and easy to test on its own.
import type { Chapter } from "@/types/lesson";

// ---- The index: what the server sends to the search ----

export type Category = "vocab" | "grammar" | "script" | "practice" | "answers";

// One study page, as the result cards name it
export type SearchPage = {
  href: string; // "/chapters/6"
  name: string; // "Chapter 6: Adjectives"
};

// One searchable entry: a table row, a paragraph or a list point on a study page
export type SearchEntry = {
  id: number;       // position in the index, stable while the data stays the same
  p: number;        // the page it is on: index into SearchIndex.pages
  a: string;        // the heading it sits under (or its page section), always an id on that page
  ch: string;       // chapter: "1" to "10", or "kana", "kanji", "practice"
  c: Category;
  b: string;        // where on the page: "Vocabulary › Places"
  x: string;        // plain text, used for matching and display
  h: number | null; // table rows: index into SearchIndex.headers; paragraphs and list points: null
};

export type SearchIndex = {
  pages: SearchPage[];
  headers: string[][]; // each distinct column header list, stored once
  entries: SearchEntry[];
};

export type ChapterOption = { value: string; label: string };

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
// fall back to "all", so a mistyped (or old) link still opens a working search.
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

// Nothing until there is text or a filter, then a case-insensitive
// "contains" on the plain text, in page order.
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

const NAMED_CHAPTERS: Record<string, string> = { kana: "Kana", kanji: "Kanji", practice: "N5 practice" };

export function chapterLabel(value: string): string {
  return /^\d+$/.test(value) ? `Chapter ${value}` : (NAMED_CHAPTERS[value] ?? value);
}

// Numbered chapters in number order, then Kana, Kanji and N5 practice, then
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

// The study page, jumping to the heading the entry sits under
export function resultHref(entry: Pick<SearchEntry, "p" | "a">, pages: readonly SearchPage[]): string {
  return `${pages[entry.p].href}#${entry.a}`;
}

// ---- Building the index (runs on the server, see search-data.ts) ----

// One group of study pages, like every chapter
export type SearchSource = {
  kind: "chapter" | "kana" | "kanji" | "practice";
  label: string;    // "Chapter"
  basePath: string; // "/chapters"
  pages: readonly Chapter[];
};

// The page HTML comes from build_chapters_v2.py, which writes a small,
// regular set of tags, so a tokenizer is enough: headings with ids, table
// heads and rows, paragraphs and list points.
const TOKENS =
  /<h([34]) id="([^"]+)">([\s\S]*?)<\/h\1>|<thead>([\s\S]*?)<\/thead>|<tr>([\s\S]*?)<\/tr>|<(p|li)>([\s\S]*?)<\/\6>/g;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === "#") {
        const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function cells(rowHtml: string, tag: "td" | "th"): string[] {
  return [...rowHtml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => plainText(m[1]));
}

// Exercises and their answers are practice and answers wherever they are.
// Everything else on a kana or kanji page is script; on a chapter page it is
// vocabulary in the Vocabulary section and grammar in the rest.
export function categoryFor(kind: SearchSource["kind"], sectionId: string): Category {
  if (sectionId === "exercises") return "practice";
  if (sectionId === "answers") return "answers";
  if (kind === "kana" || kind === "kanji") return "script";
  return sectionId === "vocab" ? "vocab" : "grammar";
}

export function buildSearchIndex(sources: readonly SearchSource[]): SearchIndex {
  const pages: SearchPage[] = [];
  const headers: string[][] = [];
  const headerIndex = new Map<string, number>();
  const entries: SearchEntry[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const page of source.pages) {
      const p = pages.push({ href: `${source.basePath}/${page.ch}`, name: `${source.label} ${page.ch}: ${page.title}` }) - 1;
      const ch = source.kind === "chapter" ? page.ch : source.kind;
      for (const section of page.sections) {
        const c = categoryFor(source.kind, section.id);
        let anchor = section.id;
        let h3 = "";
        let h4 = "";
        let header: number | null = null;
        for (const m of section.html.matchAll(TOKENS)) {
          if (m[1]) {
            // A heading: what follows sits under it
            anchor = m[2];
            if (m[1] === "3") [h3, h4] = [plainText(m[3]), ""];
            else h4 = plainText(m[3]);
            continue;
          }
          if (m[4] !== undefined) {
            const key = JSON.stringify(cells(m[4], "th"));
            header = headerIndex.get(key) ?? null;
            if (header === null) {
              header = headers.push(JSON.parse(key)) - 1;
              headerIndex.set(key, header);
            }
            continue;
          }
          const isRow = m[5] !== undefined;
          const x = isRow ? cells(m[5], "td").join(" | ") : plainText(m[7]);
          if (!x.replace(/[\s|]/g, "")) continue;
          // The same text under the same heading is one result
          const dedupe = `${p}#${anchor}\n${x}`;
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          entries.push({
            id: entries.length,
            p,
            a: anchor,
            ch,
            c,
            b: [section.title, h3, h4].filter(Boolean).join(" › "),
            x,
            h: isRow ? header : null,
          });
        }
      }
    }
  }
  return { pages, headers, entries };
}
