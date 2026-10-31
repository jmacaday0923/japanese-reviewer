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

// Only known language columns receive the larger Japanese typography.
export function isJapaneseColumn(header: string): boolean {
  return ["japanese", "word", "kanji", "kana", "hiragana", "katakana", "example word", "dictionary form", "polite potential", "plain potential", "polite volitional", "plain volitional", "stem form", "ない form", "た form"].includes(cellText(header).toLowerCase());
}

// Reference charts keep their column relationships; sentence examples can stack.
export function isExampleTable(table: ReadingTableData): boolean {
  const labels = table.headers.map((header) => cellText(header).toLowerCase());
  return JSON.stringify(labels) === '["japanese","romaji","english"]' ||
    JSON.stringify(labels) === '["speaker","japanese","romaji","english"]';
}

export function columnKind(header: string): HintKind | null {
  const label = cellText(header).toLowerCase();
  if (label === "romaji") return "romaji";
  if (label === "english" || label === "meaning") return "english";
  if (["on'yomi", "kun'yomi", "reading", "readings", "exit reading", "japanese reading", "chinese reading"].includes(label)) return "kana";
  return null;
}

// Only hide a Kana cell when it supplies the reading for a kanji word.
// Kana prompts and kana-only vocabulary remain visible.
export function cellKind(headers: readonly string[], cells: readonly string[], column: number): HintKind | null {
  const kind = columnKind(headers[column] ?? "");
  if (kind) return kind;
  const labels = headers.map((h) => cellText(h).toLowerCase());
  if (labels[column] !== "kana") return null;
  const wordColumn = labels.includes("kanji") ? labels.indexOf("kanji") : labels.indexOf("word");
  return wordColumn >= 0 && /\p{Script=Han}/u.test(cellText(cells[wordColumn] ?? "")) ? "kana" : null;
}

// Reveal buttons and search links must not announce the hidden reading.
export function rowLabel(headers: readonly string[], cells: readonly string[], fallback: string): string {
  const labels = headers.map((h) => cellText(h).toLowerCase());
  for (const label of ["kanji", "word", "japanese", "kana"]) {
    const column = labels.indexOf(label);
    if (column >= 0 && !cellKind(headers, cells, column)) {
      const value = cellText(cells[column] ?? "");
      if (value) return value;
    }
  }
  return fallback;
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
      rows.some((row) => row.some((_, column) => cellKind(headers, row, column) !== null));
    // Leave unknown or irregular tables byte-for-byte intact.
    if (!supported || rows.length === 0 || rows.some((row) => row.length !== headers.length)) continue;
    if (match.index! > start) result.push({ type: "html", html: html.slice(start, match.index) });
    result.push({ type: "table", table: { headers, rows } });
    start = match.index! + match[0].length;
  }
  if (start < html.length) result.push({ type: "html", html: html.slice(start) });
  return result;
}
