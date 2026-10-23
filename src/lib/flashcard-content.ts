// Extract verified, structured rows; raw lesson HTML stays on the server.
import type { ReadingBlock, ReadingTableData } from "./reading-content";
import type { FlashcardDraft, FlashcardExample } from "./flashcards";
export type FlashcardContext = {
  kind: "chapter" | "kana" | "kanji" | "practice"; id: string; sectionId: string; sectionTitle: string;
};
export type FlashcardHeading = { id: string; title: string };
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function text(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? whole;
    const n = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  }).replace(/\s+/g, " ").trim();
}
function href(context: FlashcardContext, anchor: string) {
  return "/" + (context.kind === "chapter" ? "chapters" : context.kind) + "/" + context.id + "#" + anchor;
}
export function lastFlashcardHeading(html: string, previous: FlashcardHeading): FlashcardHeading {
  let result = previous;
  for (const match of html.matchAll(/<h([34]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)) result = { id: match[2], title: text(match[3]) };
  return result;
}
const eligible = (context: FlashcardContext) => context.kind !== "practice" && ["lessons", "vocab", "mixups"].includes(context.sectionId);
export function collectFlashcardExamples(sections: readonly { id: string; title: string; html: string }[], page: Pick<FlashcardContext, "kind" | "id">): FlashcardExample[] {
  const examples: FlashcardExample[] = [];
  for (const section of sections) {
    const context = { ...page, sectionId: section.id, sectionTitle: section.title };
    if (!eligible(context)) continue;
    let anchor = section.id;
    const tokens = /<h([34]) id="([^"]+)">([\s\S]*?)<\/h\1>|<div class="tw"><table>([\s\S]*?)<\/table><\/div>/g;
    for (const match of section.html.matchAll(tokens)) {
      if (match[1]) { anchor = match[2]; continue; }
      const headers = [...match[4].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]).toLowerCase());
      const j = headers.indexOf("japanese"), r = headers.indexOf("romaji"), e = headers.indexOf("english");
      if (j < 0 || e < 0) continue;
      for (const row of match[4].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
        const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
        if (!cells[j] || !cells[e] || !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(cells[j])) continue;
        examples.push({ japanese: cells[j], romaji: r < 0 ? "" : cells[r] ?? "", english: cells[e], href: href(context, anchor) });
      }
    }
  }
  return examples;
}
function wordInSentence(sentence: string, word: string): boolean {
  const haystack = sentence.toLowerCase(), needle = word.toLowerCase().trim();
  if (!needle) return false;
  let at = haystack.indexOf(needle);
  while (at >= 0) {
    if (!/[a-z0-9]/i.test(haystack[at - 1] ?? "") && !/[a-z0-9]/i.test(haystack[at + needle.length] ?? "")) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}
export function tableFlashcards(table: ReadingTableData, context: FlashcardContext, heading: FlashcardHeading, examples: readonly FlashcardExample[] = []): (FlashcardDraft | null)[] {
  if (!eligible(context)) return table.rows.map(() => null);
  const headers = table.headers.map((h) => text(h).toLowerCase());
  const source = { key: context.kind + ":" + context.id,
    label: (context.kind === "chapter" ? "Chapter" : context.kind === "kana" ? "Kana" : "Kanji") + " " + context.id + " › " + heading.title,
    href: href(context, heading.id) };
  return table.rows.map((row) => {
    const values = row.map(text), get = (label: string) => values[headers.indexOf(label)] ?? "";
    let kind: FlashcardDraft["kind"], japanese = "", kana = "", romaji = get("romaji"), meaning = get("english");
    if (headers.includes("hiragana") && headers.includes("katakana") && romaji) {
      kind = "kana";
      japanese = [get("hiragana"), get("katakana")].filter((value) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)).join(" / ");
      meaning = romaji; // A character has a pronunciation, not an invented English meaning.
    } else if (headers.includes("example word") && headers.includes("meaning")) {
      const word = get("example word").match(/^(.+?)\s*[(（]([^)）]+)[)）]\s*$/u);
      if (!word) return null;
      kind = "vocabulary"; japanese = word[1].trim(); romaji = word[2].trim(); meaning = get("meaning");
    } else if (headers.includes("pair") && headers.includes("kanji") && headers.includes("readings")) {
      kind = "kanji"; japanese = get("kanji"); kana = get("readings"); meaning = get("pair"); romaji = "";
    } else if (headers.includes("dictionary form") && headers.includes("plain potential") && headers.includes("polite potential") && get("meaning")) {
      kind = "vocabulary"; japanese = get("plain potential"); meaning = get("meaning"); romaji = "";
    } else if (headers.includes("dictionary form") && headers.includes("plain volitional") && headers.includes("polite volitional") && get("meaning")) {
      kind = "vocabulary"; japanese = get("plain volitional"); meaning = get("meaning"); romaji = "";
    } else if (headers.includes("japanese") && meaning) {
      kind = "sentence"; japanese = get("japanese");
    } else if (headers.includes("meaning") && headers.includes("on'yomi") && headers.includes("kun'yomi")) {
      kind = "kanji"; japanese = heading.title.match(/^([\p{Script=Han}々]+)\s*[(（]/u)?.[1] ?? "";
      kana = [["On’yomi", get("on'yomi")], ["Kun’yomi", get("kun'yomi")]].filter(([, value]) => value).map(([label, value]) => label + ": " + value).join(" · ");
      meaning = get("meaning"); romaji = "";
    } else if (meaning && headers.includes("romaji") && (headers.includes("word") || headers.includes("kanji"))) {
      kind = "vocabulary"; japanese = [get("kanji"), get("word"), get("kana")].find((value) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) ?? ""; kana = get("kana");
    } else return null;
    if (!japanese || !meaning || !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(japanese)) return null;
    // Attach only a real source sentence. No generated translations or guessed readings.
    const example = kind === "sentence" || kind === "kana" ? undefined : examples.find((item) => kind === "kanji"
      ? item.japanese.includes(japanese)
      : wordInSentence(item.romaji, romaji) && (item.japanese.includes(japanese) || (!!kana && item.japanese.includes(kana))));
    return { kind, japanese, kana: kana === japanese ? "" : kana, romaji, meaning, source, ...(example ? { example } : {}) };
  });
}

// Both the lesson renderer and pre-made bank use this exact section conversion.
export function sectionFlashcards(blocks: readonly ReadingBlock[], context?: FlashcardContext, examples: readonly FlashcardExample[] = []) {
  let heading = { id: context?.sectionId ?? "", title: context?.sectionTitle ?? "" };
  const result: { block: ReadingBlock; flashcards?: (FlashcardDraft | null)[] }[] = [];
  for (const block of blocks) {
    if (block.type === "html") heading = lastFlashcardHeading(block.html, heading);
    result.push({ block, flashcards: block.type === "table" && context ? tableFlashcards(block.table, context, heading, examples) : undefined });
  }
  return result;
}
