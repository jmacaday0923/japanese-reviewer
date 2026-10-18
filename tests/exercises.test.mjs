// Tests for the interactive exercises: the bank in src/data/exercises.json
// checked against chapters.json, and the grading and retry helpers in
// src/lib/exercises.ts. Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyGrades,
  createActivity,
  editAnswer,
  gradePair,
  gradeParticle,
  incorrectIds,
  normalizeAnswer,
  restartActivity,
  retryIncorrect,
  stableShuffle,
  summarize,
  vocabularyRounds,
} from "../src/lib/exercises.ts";

const load = (file) => JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
const bank = load("exercises.json");
const chapters = load("chapters.json");

// ---- Reading the original tables (test-only; the app never parses HTML) ----

const decode = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function section(ch, id) {
  return chapters.find((c) => c.ch === ch).sections.find((s) => s.id === id).html;
}

// The rows of the table right after the heading with this id, as cell text
function tableRows(html, headingId) {
  const at = html.indexOf(`<h3 id="${headingId}">`);
  assert.notEqual(at, -1, `heading #${headingId}`);
  const next = html.indexOf("<h3", at + 1);
  const part = html.slice(at, next === -1 ? undefined : next);
  return [...part.matchAll(/<tr>(.*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td>(.*?)<\/td>/g)].map((cell) => decode(cell[1])))
    .filter((cells) => cells.length > 0);
}

// The source row for a question: chapter + part + number together
function sourceRow(ch, sectionId, headingId, number) {
  const rows = tableRows(section(ch, sectionId), headingId).filter((cells) => cells[0] === String(number));
  assert.equal(rows.length, 1, `${headingId} #${number} appears once`);
  return rows[0];
}

const allItems = bank.chapters.flatMap((c) =>
  c.sets.flatMap((s) => (s.type === "particles" ? s.questions : s.pairs).map((item) => ({ chapter: c.chapter, set: s, item })))
);

// ---- The bank ----

test("bank: chapters 1 and 2, one particle set and one vocabulary set each", () => {
  assert.equal(bank.version, 1);
  assert.deepEqual(bank.chapters.map((c) => c.chapter), ["1", "2"]);
  for (const c of bank.chapters) {
    assert.ok(chapters.some((ch) => ch.ch === c.chapter), `chapter ${c.chapter} exists`);
    assert.deepEqual(c.sets.map((s) => s.type), ["particles", "vocabulary"]);
    assert.equal(c.sets[0].questions.length, 8);
    assert.equal(c.sets[1].pairs.length, 10);
  }
});

test("bank: every set and question id is unique and stable in form", () => {
  const setIds = bank.chapters.flatMap((c) => c.sets.map((s) => s.id));
  assert.equal(new Set(setIds).size, setIds.length);
  const ids = allItems.map(({ item }) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const { chapter, set, item } of allItems) {
    assert.equal(set.id, `c${chapter}-${set.type}`);
    assert.equal(item.id, `${set.id}-${item.source.number}`);
  }
});

test("bank: source anchors are real headings in the right sections", () => {
  for (const { chapter, item } of allItems) {
    const { exercise, answerKey } = item.source;
    const toc = chapters.find((c) => c.ch === chapter).toc.map((t) => t.a);
    assert.ok(section(chapter, "exercises").includes(`<h3 id="${exercise}">`), exercise);
    assert.ok(section(chapter, "answers").includes(`<h3 id="${answerKey}">`), answerKey);
    assert.ok(toc.includes(exercise) && toc.includes(answerKey), "both are in the page outline");
    assert.ok(exercise.startsWith(`c${chapter}-`) && answerKey.startsWith(`c${chapter}-`));
  }
});

test("bank: each set covers every row of its source table, in order", () => {
  for (const c of bank.chapters) {
    for (const s of c.sets) {
      const items = s.type === "particles" ? s.questions : s.pairs;
      const { exercise, answerKey } = items[0].source;
      const questionRows = tableRows(section(c.chapter, "exercises"), exercise);
      const answerRows = tableRows(section(c.chapter, "answers"), answerKey);
      assert.deepEqual(items.map((q) => String(q.source.number)), questionRows.map((r) => r[0]));
      assert.deepEqual(items.map((q) => String(q.source.number)), answerRows.map((r) => r[0]));
      assert.ok(items.every((q) => q.source.exercise === exercise && q.source.answerKey === answerKey));
      assert.ok(section(c.chapter, "exercises").includes(`<h3 id="${exercise}">${s.title}</h3>`), "title is the part heading");
    }
  }
});

test("bank: particle prompts, answers and explanations match the source word for word", () => {
  for (const { chapter, set, item } of allItems.filter((x) => x.set.type === "particles")) {
    const [, question] = sourceRow(chapter, "exercises", item.source.exercise, item.source.number);
    const [, answer, why] = sourceRow(chapter, "answers", item.source.answerKey, item.source.number);
    assert.equal(item.prompt, question, item.id);
    assert.ok(item.prompt.includes("____"), `${item.id} has a blank`);
    assert.equal(item.answer, answer, item.id);
    assert.equal(item.why, why, item.id);
    // The answer cell is "romaji (kana)"; both are accepted, first
    const [, romaji, kana] = answer.match(/^(\w+) \((.+)\)$/);
    assert.deepEqual(item.accepted.slice(0, 2), [romaji, kana], item.id);
    assert.ok(set.title.includes(romaji), `${romaji} is one of the markers the part lists`);
  }
});

test("bank: accepted answers are deliberate and already normalized", () => {
  const extras = {};
  for (const { item } of allItems.filter((x) => x.set.type === "particles")) {
    for (const a of item.accepted) assert.equal(normalizeAnswer(a), a, `${item.id}: ${a}`);
    assert.equal(new Set(item.accepted).size, item.accepted.length);
    if (item.accepted.length > 2) extras[item.id] = item.accepted.slice(2);
    assert.ok(!item.accepted.includes("わ"), "わ is never accepted for wa");
  }
  // The only alternative the answer keys document: "You may also say ryou ni wa for emphasis."
  assert.deepEqual(extras, { "c2-particles-7": ["ni wa", "には"] });
  const q7 = allItems.find((x) => x.item.id === "c2-particles-7").item;
  assert.match(q7.why, /ni wa/);
});

test("bank: vocabulary pairs come straight from the question and answer cells", () => {
  for (const { chapter, item } of allItems.filter((x) => x.set.type === "vocabulary")) {
    const [, question] = sourceRow(chapter, "exercises", item.source.exercise, item.source.number);
    const [, answer, why] = sourceRow(chapter, "answers", item.source.answerKey, item.source.number);
    assert.equal(item.question, question, item.id);
    assert.equal(item.answer, answer, item.id);
    assert.equal(item.why, why, item.id);

    const meaning = question.match(/^What does (.+) mean\?$/);
    const say = question.match(/^Say "(.+)" in Japanese\.$/);
    assert.ok(meaning || say, `${item.id}: a question shape the bank understands`);
    if (meaning) {
      // Japanese from the question, English from the answer, no kana invented
      assert.equal(item.japanese, meaning[1]);
      assert.equal(item.english, answer);
      assert.equal(item.kana, null);
    } else {
      // English from the question; romaji and kana exactly as the answer gives them
      assert.equal(item.english, say[1]);
      assert.equal(answer, item.kana ? `${item.japanese} (${item.kana})` : item.japanese);
    }
  }
});

test("bank: items carry only their own fields, no lesson HTML", () => {
  for (const { set, item } of allItems) {
    const keys = set.type === "particles"
      ? ["accepted", "answer", "id", "prompt", "source", "why"]
      : ["answer", "english", "id", "japanese", "kana", "question", "source", "why"];
    assert.deepEqual(Object.keys(item).sort(), keys);
    assert.ok(!JSON.stringify(item).includes("<"), `${item.id} has no markup`);
  }
});

// ---- Normalizing and grading ----

test("normalizeAnswer: NFKC, trim, one space, lower-case Latin only", () => {
  assert.equal(normalizeAnswer("  WA "), "wa");
  assert.equal(normalizeAnswer("ｗａ"), "wa"); // full-width letters
  assert.equal(normalizeAnswer("Ni \t  Wa"), "ni wa");
  assert.equal(normalizeAnswer("ﾊ"), "ハ"); // half-width katakana becomes full-width, not hiragana
  assert.equal(normalizeAnswer(" は "), "は");
  assert.equal(normalizeAnswer("わ"), "わ");
});

const particle = (id) => allItems.find((x) => x.item.id === id).item;

test("gradeParticle: romaji and kana, with conservative clean-up", () => {
  const q1 = particle("c1-particles-1"); // wa (は)
  for (const answer of ["wa", "は", "WA", " Wa ", "ｗａ"]) assert.equal(gradeParticle(q1, answer), "correct", answer);
  for (const answer of ["わ", "ha", "ga", "wa.", "w a", "wa desu"]) assert.equal(gradeParticle(q1, answer), "incorrect", answer);
  assert.equal(gradeParticle(particle("c1-particles-2"), "の"), "correct");
  assert.equal(gradeParticle(particle("c1-particles-2"), "no"), "correct");
  assert.equal(gradeParticle(particle("c1-particles-2"), "to"), "incorrect");
});

test("gradeParticle: blank answers aren't graded", () => {
  const q1 = particle("c1-particles-1");
  for (const answer of ["", "   ", "　"]) assert.equal(gradeParticle(q1, answer), "blank", JSON.stringify(answer));
});

test("gradeParticle: chapter 2 part F question 7 accepts ni wa as the key says", () => {
  const q7 = particle("c2-particles-7");
  for (const answer of ["ni", "に", "ni wa", "NI  WA", "には"]) assert.equal(gradeParticle(q7, answer), "correct", answer);
  for (const answer of ["wa", "niwa", "にわ", "ga"]) assert.equal(gradeParticle(q7, answer), "incorrect", answer);
  // Question 7 of chapter 1 part A is a different question with a different answer
  assert.equal(gradeParticle(particle("c1-particles-7"), "ni"), "incorrect");
  assert.equal(gradeParticle(particle("c1-particles-7"), "wa"), "correct");
});

test("gradePair: by pair id, never by the English text", () => {
  const a = { id: "x-1", english: "bank" };
  const b = { id: "x-2", english: "bank" }; // same words, different pair
  assert.equal(gradePair(a, "x-1"), "correct");
  assert.equal(gradePair(a, "x-2"), "incorrect");
  assert.equal(gradePair(b, "x-1"), "incorrect");
  assert.equal(gradePair(a, ""), "blank");
  assert.equal(gradePair(a, "bank"), "incorrect");
});

// ---- Progress, retries and restart ----

const ids = ["q1", "q2", "q3"];

test("activity: starts with every question unanswered", () => {
  const s = createActivity(ids);
  assert.deepEqual(summarize(s), {
    total: 3, correct: 0, incorrect: 0, unanswered: 3, checked: false, complete: false, canRetry: false, retryRound: 0, firstTry: null,
  });
});

test("activity: grades are recorded once; blanks stay unanswered", () => {
  let s = createActivity(ids);
  s = applyGrades(s, { q1: "correct", q2: "incorrect", q3: "blank" });
  assert.equal(s.progress.q1.status, "correct");
  assert.equal(s.progress.q2.first, "incorrect");
  assert.equal(s.progress.q3.status, "unanswered");
  const sum = summarize(s);
  assert.equal(sum.checked, false);
  assert.equal(sum.canRetry, false, "no retry until the whole set is checked");
  assert.equal(sum.firstTry, null);
});

test("activity: editing a checked answer clears its grade, but not its first grade", () => {
  let s = createActivity(ids);
  s = editAnswer(s, "q2", "ga");
  s = applyGrades(s, { q2: "incorrect" });
  s = editAnswer(s, "q2", "wa");
  assert.deepEqual(s.progress.q2, { value: "wa", status: "unanswered", first: "incorrect" });
  s = applyGrades(s, { q2: "correct" });
  assert.deepEqual(s.progress.q2, { value: "wa", status: "correct", first: "incorrect" });
});

test("activity: a correct answer is kept: no edits, no regrading", () => {
  let s = createActivity(ids);
  s = editAnswer(s, "q1", "wa");
  s = applyGrades(s, { q1: "correct" });
  assert.equal(editAnswer(s, "q1", "ga"), s);
  assert.equal(applyGrades(s, { q1: "incorrect" }), s);
  assert.equal(s.progress.q1.value, "wa");
});

test("activity: retry clears only the incorrect answers and keeps the first score", () => {
  let s = createActivity(ids);
  for (const [id, v] of [["q1", "wa"], ["q2", "ga"], ["q3", "to"]]) s = editAnswer(s, id, v);
  s = applyGrades(s, { q1: "correct", q2: "incorrect", q3: "incorrect" });
  const before = summarize(s);
  assert.equal(before.canRetry, true);
  assert.deepEqual(before.firstTry, { correct: 1, total: 3 });
  assert.deepEqual(incorrectIds(s), ["q2", "q3"]);

  s = retryIncorrect(s);
  assert.equal(s.retryRound, 1);
  assert.deepEqual(s.progress.q1, { value: "wa", status: "correct", first: "correct" });
  assert.deepEqual(s.progress.q2, { value: "", status: "unanswered", first: "incorrect" });
  assert.deepEqual(s.progress.q3, { value: "", status: "unanswered", first: "incorrect" });
  const during = summarize(s);
  assert.equal(during.correct, 1);
  assert.equal(during.unanswered, 2);
  assert.deepEqual(during.firstTry, { correct: 1, total: 3 }, "the first score doesn't change");

  s = applyGrades(s, { q2: "correct", q3: "incorrect" });
  assert.deepEqual(incorrectIds(s), ["q3"]);
  s = retryIncorrect(s);
  s = applyGrades(s, { q3: "correct" });
  const after = summarize(s);
  assert.equal(after.complete, true);
  assert.equal(after.canRetry, false);
  assert.equal(after.retryRound, 2);
  assert.deepEqual(after.firstTry, { correct: 1, total: 3 });
});

test("activity: retry does nothing when nothing is incorrect", () => {
  let s = applyGrades(createActivity(ids), { q1: "correct" });
  assert.equal(retryIncorrect(s), s);
});

test("activity: restart clears everything and starts a new attempt", () => {
  let s = createActivity(ids);
  s = editAnswer(s, "q1", "wa");
  s = applyGrades(s, { q1: "correct", q2: "incorrect", q3: "incorrect" });
  s = retryIncorrect(s);
  const fresh = restartActivity(s);
  assert.equal(fresh.attempt, 1);
  assert.equal(fresh.retryRound, 0);
  assert.deepEqual(fresh.ids, ids);
  for (const id of ids) assert.deepEqual(fresh.progress[id], { value: "", status: "unanswered", first: null });
});

// ---- Rounds and shuffling ----

test("vocabulary rounds: ten pairs make two rounds of five, in source order", () => {
  const pairs = bank.chapters[0].sets[1].pairs;
  const rounds = vocabularyRounds(pairs);
  assert.deepEqual(rounds.map((r) => r.length), [5, 5]);
  assert.deepEqual(rounds.flat(), pairs);
});

test("stableShuffle: same seed, same order; a real permutation; never the original order", () => {
  const items = ["a", "b", "c", "d", "e"];
  for (let attempt = 0; attempt < 50; attempt++) {
    const seed = `c1-vocabulary:${attempt}:0`;
    const once = stableShuffle(items, seed);
    assert.deepEqual(stableShuffle(items, seed), once);
    assert.deepEqual([...once].sort(), items);
    assert.notDeepEqual(once, items);
  }
  assert.deepEqual(items, ["a", "b", "c", "d", "e"], "the input isn't changed");
  assert.deepEqual(stableShuffle(["only"], "x"), ["only"]);
});
