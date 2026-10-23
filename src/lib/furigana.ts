import type { CheckpointTextPart } from "@/types/checkpoint";

// Reviewed furigana for study pages that keep the book's kanji.
// Each entry maps the printed text to the same text with readings in brackets,
// for example "火よう日": "火[か]よう日[び]". Longer entries win, so context
// such as この人 or 日本人 decides the reading. No automatic transliteration.
export type FuriganaBook = { version: 1; pages: Record<string, Record<string, string>> };

const KANJI = /[\p{Script=Han}々]/u;

export function furiganaPage(book: FuriganaBook, scope: string): Record<string, string> | undefined {
  return book.pages[scope.split("/").slice(0, 2).join("/")];
}

export function parseFuriganaEntry(word: string, marked: string): CheckpointTextPart[] {
  const parts: CheckpointTextPart[] = [];
  for (const match of marked.matchAll(/([\p{Script=Han}々]+)\[([ぁ-ゖー]+)\]|([^[\]]+?)(?=[\p{Script=Han}々]+\[|$)/gu)) {
    if (match[1]) parts.push({ text: match[1], reading: match[2] });
    else parts.push({ text: match[3] });
  }
  if (parts.map(part => part.text).join("") !== word || parts.some(part => !part.reading && KANJI.test(part.text)))
    throw new Error("Invalid furigana entry: " + word);
  return parts;
}

export function furiganaParts(text: string, page: Record<string, string> | undefined): CheckpointTextPart[] {
  if (!page || !KANJI.test(text)) return [{ text }];
  const words = Object.keys(page).sort((a, b) => b.length - a.length);
  const pattern = new RegExp("(" + words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "u");
  const parts: CheckpointTextPart[] = [];
  for (const piece of text.split(pattern).filter(Boolean)) {
    if (page[piece]) parts.push(...parseFuriganaEntry(piece, page[piece]));
    else if (KANJI.test(piece)) throw new Error("Missing furigana: " + piece + " in " + text);
    else parts.push({ text: piece });
  }
  return parts;
}
