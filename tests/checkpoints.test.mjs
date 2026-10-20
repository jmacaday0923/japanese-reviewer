import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  checkpointKey, checkpointQuestions, checkpointScore, checkpointByChapter, questionScore,
  newCheckpointAttempt, chooseCheckpointAnswer, selectCheckpointPart, submitCheckpointAttempt,
  retryCheckpointIncorrect, parseCheckpointAttempt, createCheckpointStore,
} from "../src/lib/checkpoints.ts";
const read = path => readFileSync(new URL(path, import.meta.url));
const exams = JSON.parse(read("../src/data/checkpoint-exams.json"));
const chapters = JSON.parse(read("../src/data/chapters.json"));
const audit = JSON.parse(read("../migration/checkpoint-audit.json"));
const exam = exams[0], questions = checkpointQuestions(exam);
const first = questions[0], second = questions[1];
const now = "2026-10-21T09:00:00.000Z";
const choose = (state, q, choice = q.correctChoiceId) => chooseCheckpointAnswer(exam, state, q.id, choice);
const wrong = q => q.choices.find(c => c.id !== q.correctChoiceId).id;
const allCorrect = () => ({ ...newCheckpointAttempt(exam), answers: Object.fromEntries(questions.map(q => [q.id, q.correctChoiceId])) });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("exactly two cumulative exams cover all ten chapters with 70% on Chapters 6–10", () => {
  assert.deepEqual(exams.map(e => e.id), ["vocabulary", "grammar"]);
  for (const e of exams) {
    const qs = checkpointQuestions(e);
    assert.equal(qs.length, 40);
    assert.equal(qs.filter(q => Number(q.chapter) >= 6).length, 28);
    assert.deepEqual(Object.fromEntries(checkpointByChapter(e, {}).map(s => [s.chapter, s.total])), audit.chapterQuotaPerExam);
    assert.deepEqual(qs.map(q => q.number), Array.from({ length: 40 }, (_, i) => i + 1));
    assert.equal(new Set(qs.map(q => q.id)).size, 40);
  }
});
test("all eighty questions have four distinct Japanese choices, valid keys and real lesson anchors", () => {
  const ids = new Set();
  for (const e of exams) for (const q of checkpointQuestions(e)) {
    assert.equal(ids.has(q.id), false); ids.add(q.id);
    assert.equal(q.choices.length, 4);
    assert.deepEqual(q.choices.map(c => c.id), ["1", "2", "3", "4"]);
    assert.equal(new Set(q.choices.map(c => c.text)).size, 4);
    assert.ok(q.choices.some(c => c.id === q.correctChoiceId));
    assert.ok(q.explanationJa && q.explanationEn);
    assert.equal(q.source.chapter, q.chapter);
    const chapter = chapters.find(c => c.ch === q.chapter);
    assert.ok(chapter.sections.some(s => s.html.includes('id="' + q.source.heading + '"')), q.id);
    assert.doesNotMatch([q.prompt, q.context ?? "", q.passage?.text ?? "", ...q.choices.map(c => c.text)].join(""), /[A-Za-z]|<ruby|<rt>/);
    if (q.target) assert.ok(q.source.evidence.includes(q.target), q.id);
  }
  assert.equal(ids.size, 80);
});
test("the bank includes all intended formats, consistent starred keys and four paired text passages", () => {
  assert.deepEqual(exams[0].parts.map(p => p.questions.length), [8, 8, 16, 8]);
  assert.deepEqual(exams[1].parts.map(p => p.questions.length), [24, 8, 8]);
  for (const q of exams[1].parts[1].questions) {
    const c = q.composition;
    assert.equal(c.orderedParts.length, 4);
    assert.equal(new Set(c.orderedParts).size, 4);
    assert.equal(q.choices.find(x => x.id === q.correctChoiceId).text, c.orderedParts[c.starIndex]);
    assert.equal(q.completedSentence, c.before + " " + c.orderedParts.join(" ") + c.after);
    assert.ok(q.choices.every(choice => !/[。？]/.test(choice.text)));
    assert.deepEqual(new Set(q.choices.map(x => x.text)), new Set(c.orderedParts));
  }
  assert.equal(new Set(exams[1].parts[2].questions.map(q => q.passage.id)).size, 4);
});
test("curated keys and source hashes match the content audit", () => {
  assert.equal(hash(read("../src/data/checkpoint-exams.json")), audit.dataSha256);
  assert.equal(hash(read("../src/data/chapters.json")), audit.chapterDataSha256);
  for (const e of exams) {
    const reviewed = audit.exams.find(x => x.id === e.id);
    for (const q of checkpointQuestions(e)) {
      const entry = reviewed.questions.find(x => x.id === q.id);
      assert.equal(entry.correctChoiceId, q.correctChoiceId);
      assert.equal(entry.correctText, q.choices.find(c => c.id === q.correctChoiceId).text);
    }
  }
});
test("scores distinguish blanks and mistakes; chapter and question-type totals reconcile", () => {
  const answers = { [first.id]: first.correctChoiceId, [second.id]: wrong(second) };
  assert.deepEqual(checkpointScore(exam, answers), { correct: 1, total: 40, unanswered: 38 });
  const chapters = checkpointByChapter(exam, answers);
  for (const key of ["correct", "total", "unanswered"]) assert.equal(chapters.reduce((sum, s) => sum + s[key], 0), checkpointScore(exam, answers)[key]);
  assert.deepEqual(questionScore(exam.parts[0].questions, answers), { correct: 1, total: 8, unanswered: 6 });
});
test("invalid answers and part IDs cannot change an attempt", () => {
  const state = newCheckpointAttempt(exam);
  assert.equal(chooseCheckpointAnswer(exam, state, "missing", "1"), state);
  assert.equal(chooseCheckpointAnswer(exam, state, first.id, "5"), state);
  assert.equal(selectCheckpointPart(exam, state, "unknown"), state);
  assert.equal(selectCheckpointPart(exam, state, state.partId), state);
  assert.equal(selectCheckpointPart(exam, state, exam.parts[1].id).partId, exam.parts[1].id);
});
test("submission locks answers and records only one original assessment", () => {
  const state = submitCheckpointAttempt(exam, choose(newCheckpointAttempt(exam), first), now);
  assert.equal(state.submitted, true);
  assert.equal(state.history.length, 1);
  assert.deepEqual(state.firstAnswers, { [first.id]: first.correctChoiceId });
  assert.equal(state.history[0].correct, 1);
  assert.equal(choose(state, first, wrong(first)), state);
  assert.equal(submitCheckpointAttempt(exam, state, now), state);
});
test("retry clears only mistakes and blanks without altering the first score or adding history", () => {
  const before = choose(choose(newCheckpointAttempt(exam), first), second, wrong(second));
  const submitted = submitCheckpointAttempt(exam, before, now);
  const retry = retryCheckpointIncorrect(exam, submitted);
  assert.equal(retry.submitted, false);
  assert.equal(retry.retryRound, 1);
  assert.deepEqual(retry.locked, [first.id]);
  assert.deepEqual(retry.answers, { [first.id]: first.correctChoiceId });
  assert.equal(choose(retry, first, wrong(first)), retry);
  const resubmitted = submitCheckpointAttempt(exam, choose(retry, second), now);
  assert.equal(resubmitted.history.length, 1);
  assert.equal(checkpointScore(exam, resubmitted.answers).correct, 2);
  assert.equal(checkpointScore(exam, resubmitted.firstAnswers).correct, 1);
  assert.deepEqual(parseCheckpointAttempt(exam, JSON.stringify(resubmitted)), resubmitted);
});
test("retry selects the part containing the first incorrect item and is a no-op for full marks", () => {
  let state = newCheckpointAttempt(exam);
  for (const q of exam.parts[0].questions) state = choose(state, q);
  const retry = retryCheckpointIncorrect(exam, submitCheckpointAttempt(exam, state, now));
  assert.equal(retry.partId, exam.parts[1].id);
  const perfect = submitCheckpointAttempt(exam, allCorrect(), now);
  assert.equal(retryCheckpointIncorrect(exam, perfect), perfect);
});
test("a fresh attempt keeps history, resets all answers and can record a new score", () => {
  const prior = submitCheckpointAttempt(exam, choose(newCheckpointAttempt(exam), first), now);
  const fresh = newCheckpointAttempt(exam, prior);
  assert.equal(fresh.attempt, 2); assert.equal(fresh.firstAnswers, null);
  assert.deepEqual(fresh.answers, {}); assert.deepEqual(fresh.locked, []);
  assert.equal(fresh.history.length, 1);
  const next = submitCheckpointAttempt(exam, allCorrectForAttempt(fresh), now);
  assert.deepEqual(next.history.map(h => h.correct), [1, 40]);
  assert.deepEqual(parseCheckpointAttempt(exam, JSON.stringify(next)), next);
});
function allCorrectForAttempt(state) { return { ...state, answers: allCorrect().answers }; }
test("history is bounded to the ten latest full attempts", () => {
  let state = newCheckpointAttempt(exam);
  for (let i = 0; i < 12; i++) {
    state = submitCheckpointAttempt(exam, state, now);
    if (i < 11) state = newCheckpointAttempt(exam, state);
  }
  assert.deepEqual(state.history.map(h => h.attempt), [3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(parseCheckpointAttempt(exam, JSON.stringify(state)), state);
});
test("malformed, outdated and inconsistent stored attempts reset without crashing", () => {
  const state = submitCheckpointAttempt(exam, choose(newCheckpointAttempt(exam), first), now);
  for (const value of [null, "{", "[]", "null", "x".repeat(100001),
    JSON.stringify({ ...state, examRevision: 99 }), JSON.stringify({ ...state, examId: "grammar" }),
    JSON.stringify({ ...state, partId: "missing" }), JSON.stringify({ ...state, answers: { [first.id]: "9" } }),
    JSON.stringify({ ...state, locked: [second.id] }), JSON.stringify({ ...state, firstAnswers: null }),
    JSON.stringify({ ...state, history: [{ ...state.history[0], correct: 40 }] }),
    JSON.stringify({ ...state, history: [{ ...state.history[0], completedAt: "not a date" }] }),
    JSON.stringify({ ...state, history: [state.history[0], state.history[0]] })]) {
    assert.deepEqual(parseCheckpointAttempt(exam, value), newCheckpointAttempt(exam), value?.slice(0,100));
  }
});
test("server snapshots do not touch browser APIs; subscribing hydrates and edits persist", () => {
  let reads = 0, raw = null;
  const store = createCheckpointStore(exam, { getStorage: () => ({ getItem() { reads++; return raw; }, setItem(key, value) { assert.equal(key, checkpointKey(exam)); raw = value; } }) });
  assert.equal(store.getServerSnapshot().ready, false); assert.equal(reads, 0);
  const stop = store.subscribe(() => {});
  assert.equal(store.getSnapshot().ready, true); assert.equal(reads, 1);
  store.update(state => choose(state, first));
  const snapshot = store.getSnapshot(); assert.equal(snapshot, store.getSnapshot());
  assert.equal(parseCheckpointAttempt(exam, raw).answers[first.id], first.correctChoiceId);
  stop();
});
test("blocked browser storage retains the open attempt and reports unsaved state", () => {
  const store = createCheckpointStore(exam, { getStorage: () => { throw Error("blocked"); } });
  const stop = store.subscribe(() => {});
  store.update(state => choose(state, first));
  assert.equal(store.getSnapshot().saved, false);
  assert.equal(store.getSnapshot().state.answers[first.id], first.correctChoiceId);
  stop();
});
test("other tabs synchronize only this exam, and storage clearing resets it", () => {
  const events = new EventTarget(); let raw = null, calls = 0;
  const store = createCheckpointStore(exam, { getStorage: () => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }), getEvents: () => events });
  const stop = store.subscribe(() => calls++);
  const send = key => { const event = new Event("storage"); Object.defineProperty(event, "key", { value: key }); events.dispatchEvent(event); };
  raw = JSON.stringify(choose(newCheckpointAttempt(exam), first));
  send(checkpointKey(exams[1])); assert.equal(calls, 0);
  send(checkpointKey(exam)); assert.equal(calls, 1); assert.equal(store.getSnapshot().state.answers[first.id], first.correctChoiceId);
  raw = null; send(null); assert.deepEqual(store.getSnapshot().state, newCheckpointAttempt(exam));
  stop(); send(null); assert.equal(calls, 2);
});


test("returning to a cached exam resubscribes to the latest saved answers", () => {
  let raw = null;
  const store = createCheckpointStore(exam, { getStorage: () => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }) });
  const stop = store.subscribe(() => {}); stop();
  raw = JSON.stringify(choose(newCheckpointAttempt(exam), first));
  const stopAgain = store.subscribe(() => {});
  assert.equal(store.getSnapshot().state.answers[first.id], first.correctChoiceId);
  stopAgain();
});
