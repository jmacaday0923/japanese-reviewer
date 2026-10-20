import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { newListeningAttempt, listeningQuestions, listeningScore, chooseListeningAnswer, selectListeningSection,
  submitListeningAttempt, retryListeningIncorrect, parseListeningAttempt, createListeningStore, listeningKey } from "../src/lib/listening.ts";
const exam = JSON.parse(readFileSync(new URL("../src/data/listening-exams.json", import.meta.url), "utf8"))[0];
const questions = listeningQuestions(exam);
const choose = (state, id, answer) => chooseListeningAnswer(exam, state, id, answer);
const first = questions[0], second = questions[1];
function storage(raw = null) {
  return { raw, fail: false, getItem() { return this.raw; }, setItem(key, value) { assert.equal(key, listeningKey(exam)); if (this.fail) throw Error("blocked"); this.raw = value; } };
}

test("listening content: 24 source questions, generated key, valid choices and complete media", () => {
  assert.deepEqual(exam.sections.map(section => section.questions.length), [7, 6, 5, 6]);
  assert.equal(new Set(questions.map(q => q.id)).size, 24);
  assert.deepEqual(exam.sections.map(s => s.questions.map(q => q.correctChoiceId).join("")), ["1414321", "341242", "23112", "321123"]);
  assert.match(exam.answerKeyNotice, /Generated practice/);
  for (const section of exam.sections) {
    assert.ok(existsSync(new URL("../public" + section.audioSrc, import.meta.url)));
    for (const question of section.questions) {
      assert.ok(question.choices.some(c => c.id === question.correctChoiceId));
      assert.equal(new Set(question.choices.map(c => c.id)).size, question.choices.length);
      assert.ok(question.explanationJa && question.explanationEn && question.evidenceJa);
      assert.ok(question.evidenceStartSeconds >= 0 && question.evidenceStartSeconds < section.audioDurationSeconds);
      if (question.image) assert.ok(existsSync(new URL("../public" + question.image.src, import.meta.url)));
    }
  }
});

test("listening score separates correct, incorrect and unanswered answers", () => {
  let state = newListeningAttempt(exam);
  assert.deepEqual(listeningScore(exam, state), { correct: 0, unanswered: 24, total: 24 });
  state = choose(state, first.id, "1"); state = choose(state, second.id, "1");
  assert.deepEqual(listeningScore(exam, state), { correct: 1, unanswered: 22, total: 24 });
});

test("listening answers and sections reject unknown IDs and invalid choices", () => {
  const state = newListeningAttempt(exam);
  assert.equal(choose(state, "missing", "1"), state);
  assert.equal(choose(state, first.id, "9"), state);
  assert.equal(selectListeningSection(exam, state, "missing"), state);
  const next = selectListeningSection(exam, state, exam.sections[1].id);
  assert.equal(next.sectionId, exam.sections[1].id);
  assert.deepEqual(next.answers, {});
});

test("submission locks edits and keeps the first score stable", () => {
  const state = submitListeningAttempt(exam, choose(newListeningAttempt(exam), first.id, "1"));
  assert.deepEqual(state.firstScore, { correct: 1, total: 24, unanswered: 23 });
  assert.equal(choose(state, first.id, "2"), state);
  assert.equal(submitListeningAttempt(exam, state), state);
});

test("retry keeps correct answers, clears incorrect and blank answers, and retains first score", () => {
  let state = choose(choose(newListeningAttempt(exam), first.id, "1"), second.id, "1");
  state = submitListeningAttempt(exam, state);
  const retry = retryListeningIncorrect(exam, state);
  assert.equal(retry.submitted, false); assert.equal(retry.retryRound, 1);
  assert.deepEqual(retry.answers, { [first.id]: "1" });
  assert.deepEqual(retry.locked, [first.id]); assert.deepEqual(retry.firstScore, state.firstScore);
  assert.equal(choose(retry, first.id, "2"), retry);
  const all = { ...newListeningAttempt(exam), answers: Object.fromEntries(questions.map(q => [q.id, q.correctChoiceId])) };
  const complete = submitListeningAttempt(exam, all);
  assert.equal(retryListeningIncorrect(exam, complete), complete);
});

test("restart produces a new empty attempt with no score or locks", () => {
  const state = newListeningAttempt(exam, 2);
  assert.equal(state.attempt, 2); assert.deepEqual(state.answers, {}); assert.equal(state.firstScore, null);
  assert.deepEqual(state.locked, []); assert.equal(state.retryRound, 0);
});

test("stored attempts round-trip and malformed, incompatible or tampered state resets", () => {
  const state = submitListeningAttempt(exam, choose(newListeningAttempt(exam), first.id, "1"));
  assert.deepEqual(parseListeningAttempt(exam, JSON.stringify(state)), state);
  for (const raw of [null, "{", "null", "[]", JSON.stringify({ ...state, examRevision: 99 }),
    JSON.stringify({ ...state, answers: { missing: "1" } }), JSON.stringify({ ...state, answers: { [first.id]: "7" } }),
    JSON.stringify({ ...state, firstScore: { correct: 25, total: 24, unanswered: 0 } }),
    JSON.stringify({ ...state, firstScore: null }), JSON.stringify({ ...state, locked: [second.id] })]) {
    assert.deepEqual(parseListeningAttempt(exam, raw), newListeningAttempt(exam));
  }
});

test("browser store hydrates lazily, persists edits and exposes stable snapshots", () => {
  const disk = storage(); const store = createListeningStore(exam, { getStorage: () => disk });
  assert.equal(store.getSnapshot().ready, false); assert.equal(store.getServerSnapshot().ready, false);
  let calls = 0; const stop = store.subscribe(() => calls++);
  assert.equal(store.getSnapshot().ready, true);
  store.update(state => choose(state, first.id, "1"));
  const snapshot = store.getSnapshot(); assert.equal(store.getSnapshot(), snapshot); assert.equal(calls, 1);
  assert.equal(parseListeningAttempt(exam, disk.raw).answers[first.id], "1"); stop();
});

test("blocked storage keeps answers in memory and reports unsaved state", () => {
  const disk = storage(); const store = createListeningStore(exam, { getStorage: () => disk });
  disk.fail = true; store.update(state => choose(state, first.id, "1"));
  assert.equal(store.getSnapshot().saved, false); assert.equal(store.getSnapshot().state.answers[first.id], "1");
  const blocked = createListeningStore(exam, { getStorage: () => { throw Error("blocked"); } });
  const stop = blocked.subscribe(() => {});
  blocked.update(state => choose(state, first.id, "1"));
  assert.equal(blocked.getSnapshot().state.answers[first.id], "1"); stop();
});

test("other tabs synchronize this exam and storage clearing, without reacting to unrelated keys", () => {
  const disk = storage(), events = new EventTarget();
  const store = createListeningStore(exam, { getStorage: () => disk, getEvents: () => events });
  let calls = 0; const stop = store.subscribe(() => calls++);
  const send = key => { const event = new Event("storage"); Object.defineProperty(event, "key", { value: key }); events.dispatchEvent(event); };
  disk.raw = JSON.stringify(choose(newListeningAttempt(exam), first.id, "1"));
  send("japanese-reviewer:flashcards"); assert.equal(calls, 0);
  send(listeningKey(exam)); assert.equal(store.getSnapshot().state.answers[first.id], "1"); assert.equal(calls, 1);
  disk.raw = null; send(null); assert.deepEqual(store.getSnapshot().state.answers, {}); stop();
  send(null); assert.equal(calls, 2);
});
