// Controlled source HTML uses simple .tw table wrappers. Parsing stays on the server.
// The search also uses the column classifiers, without importing any page data.
import type { HintKind } from "@/lib/reading-preferences";

export type ReadingTableData = { headers: string[]; rows: string[][] };
export type ReadingBlock = { type: "html"; html: string } | { type: "table"; table: ReadingTableData };

export function cellText(html: string): string {
  return html.replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#([0-9]+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

export function columnKind(header: string): HintKind | null {
  const label = cellText(header).toLowerCase();
  if (label === "romaji") return "romaji";
  if (label === "english" || label === "meaning") return "english";
  if (["on'yomi", "kun'yomi", "reading", "readings", "exit reading", "japanese reading", "chinese reading"].includes(label)) return "furigana";
  return null;
}

// A Kana column paired with a kanji word is a reading aid, even when alternatives
// make the pair unsuitable for automatic ruby markup. Basic kana prompts stay visible.
export function cellKind(headers: readonly string[], cells: readonly string[], column: number): HintKind | null {
  const kind = columnKind(headers[column] ?? "");
  if (kind) return kind;
  const labels = headers.map((h) => cellText(h).toLowerCase());
  if (labels[column] !== "kana") return null;
  const wordColumn = labels.includes("kanji") ? labels.indexOf("kanji") : labels.indexOf("word");
  return wordColumn >= 0 && /\p{Script=Han}/u.test(cellText(cells[wordColumn] ?? "")) ? "furigana" : null;
}

export function furiganaPair(headers: readonly string[], cells: readonly string[]): { column: number; kanaColumn: number; word: string; reading: string } | null {
  const labels = headers.map((h) => cellText(h).toLowerCase());
  const kanaColumn = labels.indexOf("kana");
  const column = labels.includes("kanji") ? labels.indexOf("kanji") : labels.indexOf("word");
  if (kanaColumn < 0 || column < 0 || column === kanaColumn) return null;
  const word = cellText(cells[column] ?? "");
  const reading = cellText(cells[kanaColumn] ?? "");
  // Skip alternatives, notes, multiple words, and unknown readings.
  if (!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]+$/u.test(word) ||
      !/\p{Script=Han}/u.test(word) ||
      !/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(reading)) return null;
  return { column, kanaColumn, word, reading };
}

export function splitReadingContent(html: string): ReadingBlock[] {
  const result: ReadingBlock[] = [];
  const wrappers = /<div class="tw"><table>([\s\S]*?)<\/table><\/div>/g;
  let start = 0;
  for (const match of html.matchAll(wrappers)) {
    const tableHtml = match[1];
    const headers = [...tableHtml.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => m[1]);
    const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((row) => [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]))
      .filter((row) => row.length > 0);
    const supported = headers.some((h) => columnKind(h) !== null) ||
      rows.some((row) => furiganaPair(headers, row) !== null);
    // Leave unknown or irregular tables byte-for-byte intact.
    if (!supported || rows.length === 0 || rows.some((row) => row.length !== headers.length)) continue;
    if (match.index! > start) result.push({ type: "html", html: html.slice(start, match.index) });
    result.push({ type: "table", table: { headers, rows } });
    start = match.index! + match[0].length;
  }
  if (start < html.length) result.push({ type: "html", html: html.slice(start) });
  return result;
}
