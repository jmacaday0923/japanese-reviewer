import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkpointTextParts } from "../src/lib/checkpoint-display.ts";
const read = file => JSON.parse(readFileSync(new URL("../src/data/" + file + ".json", import.meta.url), "utf8"));
const bank = read("checkpoint-exams"), exam = bank.find(e => e.id === "chapter-5"), display = read("chapter-5-checkpoint-display");
const questions = exam.parts.flatMap(p => p.questions);
const rendered = text => checkpointTextParts(text, display).map(p => p.text).join("");
const japanese = /[\p{Script=Han}々]/u;
const fields = e => e.parts.flatMap(p => [p.titleJa, p.instructionsJa, ...p.questions.flatMap(q => [q.prompt, q.context ?? "", q.passage?.text ?? "", ...q.choices.map(c => c.text), q.completedSentence ?? "", q.explanationJa, q.explanationEn])]);

test("all Chapter 5 instructions are bilingual and every override matches existing source text", () => {
  assert.equal(display.examId, "chapter-5");
  assert.deepEqual(Object.keys(display.instructionsEn), exam.parts.map(p => p.id));
  const source = new Set(fields(exam));
  for (const text of Object.keys(display.kana)) assert.ok(source.has(text), text);
  for (const p of exam.parts) {
    assert.match(display.instructionsEn[p.id], /1, 2, 3 or 4/);
    assert.doesNotMatch(rendered(p.titleJa) + rendered(p.instructionsJa), japanese);
  }
});

test("every displayed kanji across all 54 questions, three passages and feedback has a reviewed reading", () => {
  const before = structuredClone(exam), retained = new Set();
  for (const text of fields(exam)) for (const part of checkpointTextParts(text, display)) {
    if (japanese.test(part.text)) {
      assert.ok(part.reading, part.text); retained.add(part.text);
      assert.match(part.reading, /^[ぁ-ゖー]+$/u);
    } else assert.equal(part.reading, undefined);
  }
  assert.deepEqual([...retained].sort(), ["円", "名前", "日本", "日曜日", "月曜日", "金曜日"].sort());
  for (const q of questions) assert.doesNotMatch(rendered(q.explanationJa), japanese);
  assert.equal(new Set(questions.filter(q => q.passage).map(q => q.passage.id)).size, 3);
  assert.deepEqual(exam, before);
  assert.equal(exam.revision, 1);
});

test("numeric clues and all choices preserve their values without spelling out date or number answers", () => {
  for (const [number, clue] of [[17,"800円"],[18,"4つ"],[22,"3,000円"],[23,"120,000円"],[26,"9がつ"],[27,"6/20"],[28,"4じ"],[29,"10じ"],[34,"2じかん"],[38,"6かげつ"]]) {
    const q = questions[number - 1], parts = checkpointTextParts(q.prompt, display);
    assert.ok(rendered(q.prompt).includes(clue), String(number));
    assert.ok(!parts.map(p => p.text + (p.reading ?? "")).join("").replace(/\s/g, "").includes(q.choices.find(c => c.id === q.correctChoiceId).text.replace(/\s/g, "")), String(number));
  }
  for (const q of questions) {
    if (!japanese.test(q.prompt)) assert.equal(rendered(q.prompt), q.prompt);
    assert.equal((rendered(q.prompt).match(/（　）/g) ?? []).length, (q.prompt.match(/（　）/g) ?? []).length);
    for (const choice of q.choices) assert.equal(rendered(choice.text), choice.text);
  }
  assert.match(rendered(questions[37].explanationJa), /6かげつ/);
  assert.doesNotMatch(rendered(questions[26].prompt), /はつか/);
});

test("longer reviewed words keep their reading and unknown kanji require a content review", () => {
  assert.deepEqual(checkpointTextParts("名前は 日本の 月曜日", display), [
    { text: "名前", reading: "なまえ" }, { text: "は " }, { text: "日本", reading: "にほん" }, { text: "の " }, { text: "月曜日", reading: "げつようび" },
  ]);
  assert.throws(() => checkpointTextParts("京都", display), /Missing Chapter 5 checkpoint reading/);
});

test("omitting the Chapter 5 presentation leaves both Chapter 10 exams' text untouched", () => {
  for (const e of bank.filter(e => e.id !== "chapter-5")) for (const text of fields(e))
    assert.deepEqual(checkpointTextParts(text), [{ text }]);
});
