// One document: a reviewer, a chapter, the kana chart, etc.
export type Doc = {
  n: number;            // document number (its id)
  title: string;
  kind: string;         // "Reviewer", "Vocabulary", "Kana", ...
  date: string;
  chapters: string[];   // chapters it covers, like ["1", "2"]
  link: string;         // link to the original page
  intro: string;
  html: string;         // full content as HTML
  toc: { a: string; t: string; l: number }[]; // headings: anchor, text, level
};

// Fields every searchable item shares
type ItemBase = {
  d: number;   // which Doc it belongs to (matches Doc.n)
  a: string;   // anchor of the section it sits in
  ch: string;  // chapter, or "gen" for general
  c: "vocab" | "grammar" | "script" | "practice" | "answers";
  b: string;   // breadcrumb, like "Chapter 2 › Places"
  x: string;   // plain text, used for searching
};

// A table row, like a vocab entry
export type RowItem = ItemBase & {
  t: "r";
  hd: string[];     // column headers: ["Kana", "Romaji", "English"]
  cells: string[];  // the row's values
};

// A paragraph or list point
export type TextItem = ItemBase & {
  t: "p" | "li";
  h: string;  // the text as HTML
};

export type Item = RowItem | TextItem;

export type LessonData = { docs: Doc[]; items: Item[] };