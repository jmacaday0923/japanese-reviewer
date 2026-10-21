import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gradeWorkbook, normalizeWorkbook, workbookOrder } from "../src/lib/workbook.ts";
import { createActivity, editAnswer, applyGrades, retryIncorrect, summarize } from "../src/lib/exercises.ts";
import { buildSearchIndex, searchGroups } from "../src/lib/search.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { collectFlashcardExamples, sectionFlashcards } from "../src/lib/flashcard-content.ts";
const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const chapters = read("src/data/chapters.json"), chapter = chapters.find(c => c.ch === "11");
const sets = read("src/data/workbook-exercises.json").chapters.find(c => c.chapter === "11").sets;
const questions = sets.flatMap(s => s.questions), audit = read("migration/chapter-11-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("Chapter 11 appends to the course while preserving every earlier chapter object", () => {
  assert.deepEqual(chapters.map(c => c.ch), Array.from({ length: 11 }, (_, i) => String(i + 1)));
  for (const previous of chapters.filter(c => c.ch !== "11")) assert.equal(hash(previous), audit.previousChapterHashes[previous.ch]);
  assert.deepEqual(chapter.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  assert.equal(chapter.sections.at(-1).title, "Model answers");
  for (const name of ["c11-11-1-wa-ga-adjectives", "c11-11-2-naru", "c11-11-3-suru", "c11-11-4-potential", "c11-11-5-mieru-kikoeru"])
    assert.ok(chapter.toc.some(t => t.a === name));
});
test("all 90 printed workbook prompts appear in twelve source-linked interactive sets", () => {
  assert.deepEqual(sets.map(s => s.questions.length), [8,9,10,10,9,10,8,8,3,2,10,3]);
  assert.equal(questions.length, 90);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../src/data/workbook-exercises.json", import.meta.url))).digest("hex"), audit.questionDataSha256);
  assert.equal(new Set(questions.map(q => q.id)).size, 90);
  assert.equal(questions.filter(q => q.mode === "self").length, 22);
  assert.equal(audit.automaticQuestions, 68); assert.equal(audit.modelAnswersAreGenerated, true);
  const html = chapter.sections.find(s => s.id === "exercises").html;
  for (const set of sets) {
    assert.ok(html.includes('data-workbook-set="' + set.id + '"'));
    assert.ok(html.includes('id="' + set.heading + '"'));
    assert.deepEqual(set.questions.map(q => q.source.number), Array.from({ length: set.questions.length }, (_, i) => i + 1));
    assert.ok(set.questions.every(q => q.source.printedPage === set.sourcePage));
    for (const q of set.questions) assert.ok(q.model && q.whyJa && q.whyEn);
    const reference = audit.sets.find(s => s.id === set.id);
    assert.deepEqual(reference.questions.map(q => q.id), set.questions.map(q => q.id));
    assert.deepEqual(reference.questions.map(q => q.model), set.questions.map(q => q.model));
    assert.ok(set.questions.every(q => q.mode === "self") || set.questions.every(q => q.mode !== "self"));
  }
});
test("Japanese prompts and choices stay native, while translation tasks retain their English cues", () => {
  for (const set of sets) for (const q of set.questions) {
    if (set.id.endsWith("translation-practice")) { assert.match(q.prompt, /[A-Za-z]/); continue; }
    assert.doesNotMatch(q.prompt + (q.choices ?? []).map(c => c.text).join(""), /[A-Za-z]|<ruby|<rt>/);
    if (q.romaji) assert.match(q.romaji, /[A-Za-z]/);
  }
});
test("reviewed multiple-choice keys match the grammar and reading models", () => {
  for (const [id, expected] of [["c11-change-choices", "3123142211"], ["c11-grammar-choices", "42341333"], ["c11-text-grammar", "344"], ["c11-reading-comprehension", "44"]]) {
    const qs = sets.find(s => s.id === id).questions;
    assert.equal(qs.map(q => q.correctChoiceId).join(""), expected);
    for (const q of qs) {
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices.map(c => c.text)).size, 4);
      assert.equal(gradeWorkbook(q, q.correctChoiceId), "correct");
    }
  }
  const flexible = sets.find(s => s.id === "c11-text-grammar").questions[2];
  assert.equal(gradeWorkbook(flexible, "1"), "correct");
  assert.equal(gradeWorkbook(flexible, "4"), "correct");
  assert.equal(gradeWorkbook(flexible, "2"), "incorrect");
});
test("potential conjugations handle five-row, one-row and special verbs", () => {
  const qs = sets.find(s => s.id === "c11-potential-forms").questions;
  assert.deepEqual(qs.map(q => q.model), ["きけます","そうじできます","おぼえられます","もてます","はたらけます","おわれます","よめます","すえます","もどれます","しつもんできます"]);
  for (const q of questions.filter(q => q.mode === "text")) {
    assert.equal(gradeWorkbook(q, q.model), "correct", q.id);
    for (const variant of q.accepted) assert.equal(gradeWorkbook(q, variant), "correct", q.id);
    assert.equal(gradeWorkbook(q, ""), "blank");
  }
  assert.equal(gradeWorkbook(qs[0], "ききます"), "incorrect");
  assert.equal(gradeWorkbook(qs[2], "おぼえれます"), "incorrect");
  const returns = sets.find(s => s.id === "c11-potential-drill").questions.at(-1);
  assert.equal(gradeWorkbook(returns, "じてんしゃでかえれます"), "correct");
  assert.equal(gradeWorkbook(returns, "じてんしゃでかえられます"), "incorrect");
});
test("written checking ignores spacing, width and final stops while keeping meaningful distinctions", () => {
  const q = sets.find(s => s.id === "c11-potential-drill").questions[1];
  assert.equal(gradeWorkbook(q, " あした　８じに　こられます。 "), "correct");
  assert.equal(gradeWorkbook(q, "あした８じにきます"), "incorrect");
  assert.notEqual(normalizeWorkbook("が"), normalizeWorkbook("か"));
  assert.notEqual(normalizeWorkbook("しょっぱい"), normalizeWorkbook("しょぱい"));
  assert.notEqual(normalizeWorkbook("きます"), normalizeWorkbook("きません"));
});
test("all eight word-order puzzles preserve each word and rebuild the complete source sentence", () => {
  for (const q of sets.find(s => s.id === "c11-word-order").questions) {
    assert.equal(q.tokens.length, 4);
    for (const order of q.acceptedOrders) {
      assert.deepEqual([...order].sort(), [0,1,2,3]);
      assert.equal(gradeWorkbook(q, order.join(",")), "correct");
      assert.equal(normalizeWorkbook((q.before ?? "") + order.map(i => q.tokens[i]).join("") + (q.after ?? "")), normalizeWorkbook(q.model));
    }
    assert.equal(gradeWorkbook(q, "0,1"), "blank");
    assert.equal(gradeWorkbook(q, "0,0,2,3"), "incorrect");
    assert.equal(gradeWorkbook(q, "0,1,2,9"), "incorrect");
  }
  assert.equal(workbookOrder("00,1,2,3",4), null);
});
test("open cloze, personal and translation questions are self-checks rather than exact-match grading", () => {
  for (const q of questions.filter(q => q.mode === "self")) {
    assert.equal(gradeWorkbook(q, ""), "blank");
    assert.equal(gradeWorkbook(q, "自分の 答えです。"), null);
    assert.equal(q.accepted, undefined);
  }
});
test("retry preserves correct answers and the first score through the shared activity state", () => {
  const set = sets.find(s => s.id === "c11-change-choices");
  let state = createActivity(set.questions.map(q => q.id));
  for (const q of set.questions) {
    const answer = q.number === 1 ? "1" : q.correctChoiceId;
    state = editAnswer(state, q.id, answer);
    state = applyGrades(state, { [q.id]: gradeWorkbook(q, answer) });
  }
  assert.deepEqual(summarize(state).firstTry, { correct: 9, total: 10 });
  const next = retryIncorrect(state);
  assert.equal(next.progress[set.questions[0].id].value, "");
  assert.equal(next.progress[set.questions[1].id].status, "correct");
  assert.deepEqual(summarize(next).firstTry, { correct: 9, total: 10 });
});
test("two Japanese reading passages keep independent closed support and source-specific vocabulary notes", () => {
  const html = chapter.sections.find(s => s.id === "exercises").html;
  assert.equal((html.match(/data-reading-exercise=/g) ?? []).length, 2);
  assert.equal((html.match(/data-reading-support="romaji"/g) ?? []).length, 2);
  assert.equal((html.match(/data-reading-support="english"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.ok(html.includes("システム工学") && html.includes("いい思い出"));
  assert.deepEqual(audit.readingNotes.map(p => p.words), [["システム工学"],["バンドのメンバー","選手","スポーツキャンプ","いい思い出"]]);
});
test("vocabulary, lesson sentences and potential forms feed search and source-backed flashcards", () => {
  const index = buildSearchIndex([{ kind:"chapter", label:"Chapter", basePath:"/chapters", pages:[chapter] }]);
  for (const query of ["kikoeru", "こられます", "systems engineering"])
    assert.ok(searchGroups(index, { q:query, category:"all", chapter:"11" }).length, query);
  const examples = collectFlashcardExamples(chapter.sections, { kind:"chapter", id:"11" });
  assert.equal(examples.length, 86);
  const cards = chapter.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind:"chapter",id:"11",sectionId:section.id,sectionTitle:section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.equal(cards.filter(c => c.kind === "vocabulary").length, 56);
  assert.equal(cards.filter(c => c.kind === "sentence").length, 86);
  assert.ok(cards.some(c => c.japanese === "こられる" && c.meaning === "can come"));
  assert.ok(cards.every(c => c.source.href.startsWith("/chapters/11#")));
});
