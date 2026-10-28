// What a saved card shows as its Japanese, following the book's pace:
// kana only before Chapter 8, then kanji only for characters from the Kanji
// lessons, always with the reading above. Saved card data never changes.
import type { SavedFlashcard } from "@/lib/flashcards";
import type { Chapter } from "@/types/lesson";

export const KANJI_FROM_CHAPTER = 8;
export type CardFace = { text: string; reading?: string; scope?: string };

const KANJI = /[\p{Script=Han}々]/gu;

// The characters taught as headings on the Kanji pages (Kanji 1 and Kanji 2).
export function kanjiLessonCharacters(pages: readonly Chapter[]): string {
  return pages.map(page => {
    const lessons = page.sections.find(section => section.id === "lessons")?.html ?? "";
    return [...lessons.matchAll(/<h3\b[^>]*>\s*([\p{Script=Han}])\s*\(/gu)].map(match => match[1]).join("");
  }).join("");
}

// Chapters 8 to 10 go with the Kanji 1 and Kanji 2 pages. Later Kanji pages
// are taught alongside later chapters, so they don't widen this set.
export const FAMILIAR_KANJI_PAGES = 2;
export const familiarKanji = (pages: readonly Chapter[]) => kanjiLessonCharacters(pages.slice(0, FAMILIAR_KANJI_PAGES));

// The earliest chapter a card was saved from decides how it looks. The Kana
// page counts as the very start of the course; Kanji pages keep their kanji.
export function firstChapter(card: Pick<SavedFlashcard, "sources">): number | null {
  const chapters = card.sources.map(source => source.key.startsWith("kana:") ? "0" : /^chapter:(\d+)$/.exec(source.key)?.[1]).filter(Boolean).map(Number);
  return chapters.length ? Math.min(...chapters) : null;
}

export function flashcardFace(card: Pick<SavedFlashcard, "kind" | "japanese" | "kana" | "sources">, familiar: string): CardFace {
  const chapter = firstChapter(card);
  if ((card.kind !== "vocabulary" && card.kind !== "sentence") || chapter === null || !card.japanese.match(KANJI)) return { text: card.japanese };
  // Chapter 11 onward keeps the book's own kanji, with readings from furigana.json.
  if (chapter > 10) return { text: card.japanese, scope: "chapter/" + chapter };
  const reading = card.kana.trim();
  const known = (card.japanese.match(KANJI) ?? []).every(character => familiar.includes(character));
  if (chapter >= KANJI_FROM_CHAPTER && known && reading && !/[/(（]/.test(card.japanese + reading)) return { text: card.japanese, reading };
  return { text: reading || card.japanese };
}
