// What the document library shows for each document, worked out on the
// server from lesson-data.json. Plain functions and types only, so the Node
// tests can run them directly.
import type { Doc, Item } from "@/types/lesson";

export type Category = Item["c"];

// The order tags always appear in, whatever order the entries come in
export const CATEGORY_ORDER: readonly Category[] = ["grammar", "vocab", "script", "practice", "answers"];

// Each document's content categories: the distinct `c` values of the
// entries that belong to it (item.d matches doc.n), in CATEGORY_ORDER.
// A document with no entries gets an empty list. Titles and Doc.kind are
// never used: kind says what sort of source it is, not what's inside.
export function documentCategories(items: readonly Pick<Item, "d" | "c">[]): Map<number, Category[]> {
  const found = new Map<number, Set<Category>>();
  for (const item of items) {
    let set = found.get(item.d);
    if (!set) found.set(item.d, (set = new Set()));
    set.add(item.c);
  }
  return new Map([...found].map(([n, set]) => [n, CATEGORY_ORDER.filter((c) => set.has(c))]));
}

// Only what a library row needs: no HTML, no outline
export type DocumentSummary = Pick<Doc, "n" | "title" | "kind" | "date" | "chapters"> & {
  categories: Category[];
};

export function documentSummaries(data: {
  docs: readonly Doc[];
  items: readonly Pick<Item, "d" | "c">[];
}): DocumentSummary[] {
  const categories = documentCategories(data.items);
  return data.docs.map((doc) => ({
    n: doc.n,
    title: doc.title,
    kind: doc.kind,
    date: doc.date,
    chapters: doc.chapters,
    categories: categories.get(doc.n) ?? [],
  }));
}

// "Chapters 1 to 5", "Chapter 6", "Kana", "Kanji"; empty when the data
// doesn't say. Ranges only for consecutive numbers.
export function chapterSummary(chapters: readonly string[]): string {
  if (chapters.length === 0) return "";
  const numbers = chapters.map(Number);
  if (numbers.every((n) => Number.isInteger(n) && n > 0)) {
    if (numbers.length === 1) return `Chapter ${numbers[0]}`;
    const consecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
    return consecutive
      ? `Chapters ${numbers[0]} to ${numbers[numbers.length - 1]}`
      : `Chapters ${numbers.join(", ")}`;
  }
  const named: Record<string, string> = { kana: "Kana", kanji: "Kanji", gen: "General" };
  return chapters.map((c) => named[c] ?? c).join(", ");
}
