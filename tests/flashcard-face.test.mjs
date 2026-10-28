import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { collectFlashcardExamples, sectionFlashcards } from "../src/lib/flashcard-content.ts";
import { flashcardFace, familiarKanji, kanjiLessonCharacters, firstChapter } from "../src/lib/flashcard-face.ts";
import { furiganaPage, furiganaParts } from "../src/lib/furigana.ts";
const load = name => JSON.parse(readFileSync(new URL("../src/data/" + name + ".json", import.meta.url), "utf8"));
const familiar = familiarKanji(load("kanji")), book = load("furigana");
const kanji = text => [...text.matchAll(/[\p{Script=Han}々]/gu)].map(m => m[0]);
const asSaved = draft => ({ ...draft, sources: [draft.source] });
function drafts(page, kind = "chapter") {
  const examples = collectFlashcardExamples(page.sections, { kind, id: page.ch });
  return page.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind, id: page.ch, sectionId: section.id, sectionTitle: section.title }, examples)
    .flatMap(item => (item.flashcards ?? []).filter(Boolean)));
}

test("the familiar kanji are the 60 characters taught on the Kanji 1 and Kanji 2 pages", () => {
  assert.equal(familiar.length, 60);
  assert.equal(new Set(familiar).size, 60);
  assert.ok(familiar.startsWith("一二三") && familiar.includes("週") && !familiar.includes("族"));
  // Kanji 3 and later pages go with later chapters and don't widen the set.
  assert.ok(load("kanji").length > 2 && !familiar.includes("大") && kanjiLessonCharacters(load("kanji")).includes("大"));
});

test("Chapters 1 to 7 cards show no kanji at all", () => {
  let checked = 0;
  for (const page of load("chapters").filter(c => Number(c.ch) < 8)) for (const draft of drafts(page)) {
    const face = flashcardFace(asSaved(draft), familiar);
    assert.deepEqual(kanji(face.text), [], page.ch + ": " + draft.japanese);
    assert.equal(face.reading, undefined);
    checked++;
  }
  assert.ok(checked > 2000);
  assert.equal(flashcardFace(asSaved({ kind: "vocabulary", japanese: "家族", kana: "かぞく", source: { key: "chapter:1" } }), familiar).text, "かぞく");
});

test("Chapters 8 to 10 show only Kanji lesson characters, always with the reading above", () => {
  let shown = 0;
  for (const page of load("chapters").filter(c => ["8", "9", "10"].includes(c.ch))) for (const draft of drafts(page)) {
    const face = flashcardFace(asSaved(draft), familiar);
    if (!kanji(face.text).length) continue;
    if (!draft.kana) { assert.equal(draft.kind, "sentence"); continue; }
    assert.ok(face.reading, draft.japanese);
    assert.ok(kanji(face.text).every(c => familiar.includes(c)), draft.japanese);
    shown++;
  }
  assert.ok(shown > 0);
  assert.equal(flashcardFace(asSaved({ kind: "vocabulary", japanese: "山", kana: "やま", source: { key: "chapter:9" } }), familiar).text, "やま");
  assert.deepEqual(flashcardFace(asSaved({ kind: "vocabulary", japanese: "今週", kana: "こんしゅう", source: { key: "chapter:9" } }), familiar), { text: "今週", reading: "こんしゅう" });
});

test("Chapter 11 keeps the book's kanji with reviewed readings; the earliest chapter decides; Kana page cards are kana and Kanji page cards keep kanji", () => {
  for (const draft of drafts(load("chapters").find(c => c.ch === "11"))) {
    const face = flashcardFace(asSaved(draft), familiar);
    if (kanji(face.text).length) { assert.equal(face.scope, "chapter/11"); furiganaParts(face.text, furiganaPage(book, face.scope)); }
  }
  const both = { kind: "vocabulary", japanese: "学生", kana: "がくせい", sources: [{ key: "chapter:9" }, { key: "chapter:1" }] };
  assert.equal(firstChapter(both), 1);
  assert.equal(flashcardFace(both, familiar).text, "がくせい");
  for (const draft of drafts(load("kanji")[0], "kanji")) assert.equal(flashcardFace(asSaved(draft), familiar).text, draft.japanese);
  for (const draft of drafts(load("kana")[0], "kana")) assert.deepEqual(kanji(flashcardFace(asSaved(draft), familiar).text), [], draft.japanese);
});
