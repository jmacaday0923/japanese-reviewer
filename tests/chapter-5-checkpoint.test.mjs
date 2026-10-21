import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { checkpointQuestions, checkpointScore, checkpointByChapter, checkpointCoverage, checkpointAnchor,
  checkpointKey, newCheckpointAttempt, parseCheckpointAttempt, submitCheckpointAttempt, retryCheckpointIncorrect } from "../src/lib/checkpoints.ts";
const bytes = name => readFileSync(new URL("../" + name, import.meta.url));
const read = name => JSON.parse(bytes(name));
const hash = value => createHash("sha256").update(value).digest("hex");
const bank = read("src/data/checkpoint-exams.json");
const exam = bank.find(e => e.id === "chapter-5"), qs = checkpointQuestions(exam);
const archive = read("src/data/practice.json")[0];
const display = read("src/data/japanese-display.json").texts;
const audit = read("migration/chapter-5-checkpoint-audit.json");
const clean = text => text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const rows = section => [...section.html.matchAll(/<tr>(.*?)<\/tr>/gs)].map(m => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(c => clean(c[1]))).filter(row => row.length);
test("all 54 original questions, keys and English explanations survive the conversion", () => {
  assert.equal(hash(bytes("src/data/practice.json")), audit.sourceSha256);
  assert.equal(hash(bytes("src/data/japanese-display.json")), audit.displayCatalogSha256);
  assert.deepEqual(exam.parts.map(p => p.questions.length), [40, 14]);
  const originals = rows(archive.sections.find(s => s.id === "exercises"));
  const keys = rows(archive.sections.find(s => s.id === "answers"));
  assert.equal(originals.length, 54); assert.equal(keys.length, 54);
  for (const [i, q] of qs.entries()) {
    const entry = audit.questions[i];
    assert.equal(entry.originalQuestion, originals[i][1]);
    assert.equal(entry.originalKey, keys[i][1]);
    assert.equal(entry.originalNumber, Number(originals[i][0]));
    assert.equal(q.number, i + 1);
    assert.equal(q.explanationEn, display[keys[i][2]] ?? keys[i][2]);
    const letter = /^\(([abcd])\)/.exec(keys[i][1])[1];
    assert.equal(q.correctChoiceId, String("abcd".indexOf(letter) + 1));
    const native = entry.nativeQuestion.split(/\([abcd]\)\s*/).slice(1);
    assert.deepEqual(q.choices.map(c => c.text), native.map(c => c.trim().replace(/\bare\b/g, "あれ")));
  }
});
test("all three passages and translations remain attached to the same 5/5/4 reading questions", () => {
  const reading = exam.parts[1].questions;
  const passages = [...new Set(reading.map(q => q.passage.id))];
  assert.equal(passages.length, 3);
  assert.deepEqual(passages.map(id => reading.filter(q => q.passage.id === id).length), [5, 5, 4]);
  const section = archive.sections.find(s => s.id === "exercises").html;
  for (const [i, id] of passages.entries()) {
    const passage = reading.find(q => q.passage.id === id).passage;
    for (const line of passage.text.split("\n")) {
      assert.ok(clean(section).replace(/\([ぁ-んー]+\)/g, "").includes(line));
    }
    assert.ok(passage.translationEn.startsWith("Passage " + (i + 1) + "."));
    assert.ok(clean(archive.sections.find(s => s.id === "answers").html).includes(passage.translationEn));
    assert.ok(reading.filter(q => q.passage.id === id).every(q => JSON.stringify(q.passage) === JSON.stringify(passage)));
  }
});
test("Japanese-only prompts retain the original disambiguating clues", () => {
  assert.doesNotMatch(qs.map(q => q.prompt + q.choices.map(c => c.text).join("")).join(""), /[A-Za-z]|<ruby|<rt>/);
  for (const [n, clue] of [[5, "じぶん"], [6, "もっています"], [9, "はんたい"], [17, "800円"], [18, "4つ"], [20, "8さい"], [22, "3,000円"], [23, "120,000円"], [26, "9月"], [27, "20日"], [28, "4時"], [34, "2時間"], [38, "6か月"]]) {
    assert.ok(qs[n - 1].prompt.includes(clue), "Question " + n);
  }
  assert.ok(qs[5].choices.some(c => c.text === "あれ"));
});
test("scores and review breakdowns reconcile out of 54 and never include Chapters 6–10", () => {
  const answers = Object.fromEntries(qs.map(q => [q.id, q.correctChoiceId]));
  assert.deepEqual(checkpointScore(exam, answers), { correct: 54, total: 54, unanswered: 0 });
  assert.deepEqual(checkpointCoverage(exam), { afterChapter: "5", label: "Chapters 1–5" });
  const groups = checkpointByChapter(exam, {});
  assert.deepEqual(groups.map(g => g.chapter), ["1", "2", "3", "4", "5"]);
  assert.equal(groups.reduce((n, g) => n + g.total, 0), 54);
  assert.equal(checkpointKey(exam), "japanese-reviewer:checkpoint:chapter-5:v1");
  const submitted = submitCheckpointAttempt(exam, { ...newCheckpointAttempt(exam), answers: { [qs[0].id]: qs[0].correctChoiceId } }, "2026-10-21T12:00:00Z");
  const retry = retryCheckpointIncorrect(exam, submitted);
  assert.deepEqual(parseCheckpointAttempt(exam, JSON.stringify(retry)), retry);
  assert.equal(checkpointScore(exam, retry.firstAnswers).correct, 1);
  assert.equal(retry.history.length, 1);
});
test("every old section, exercise, key and translation anchor resolves without selecting an answer", () => {
  const anchors = [...archive.sections.map(s => s.id), ...archive.toc.map(t => t.a)];
  assert.deepEqual(Object.keys(exam.legacyAnchors).sort(), [...new Set(anchors)].sort());
  for (const id of anchors) {
    const target = checkpointAnchor(exam, "#" + id);
    assert.ok(target, id);
    assert.ok(exam.parts.find(p => p.id === target.partId).questions.some(q => q.id === target.questionId));
  }
  assert.equal(checkpointAnchor(exam, "#%E0%A4"), null);
  assert.equal(checkpointAnchor(exam, "#constructor"), null);
  assert.equal(checkpointAnchor(exam, "#unknown"), null);
  assert.equal(checkpointAnchor(exam, "#" + qs[45].id).partId, "reading");
});
test("the existing Chapter 10 question sets, revisions and storage keys are unchanged", () => {
  for (const e of bank.filter(e => e.id !== "chapter-5")) {
    assert.equal(e.revision, 1);
    assert.equal(hash(JSON.stringify(e.parts)), audit.previousExamPartsSha256[e.id]);
    assert.equal(checkpointKey(e), "japanese-reviewer:checkpoint:" + e.id + ":v1");
  }
});
