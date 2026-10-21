import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { kanji1Characters } from "../src/lib/chapter-10-checkpoint.ts";
import { checkpointKey, checkpointQuestions, createCheckpointStore, newCheckpointAttempt, parseCheckpointAttempt, submitCheckpointAttempt, chooseCheckpointAnswer } from "../src/lib/checkpoints.ts";
const bytes = name => readFileSync(new URL("../" + name, import.meta.url));
const read = name => JSON.parse(bytes(name));
const bank = read("src/data/checkpoint-exams.json");
const chapters = read("src/data/chapters.json"), kanji = read("src/data/kanji.json");
const audit = read("migration/checkpoint-curriculum-audit.json");
const archive = read("migration/checkpoint-v1-archive.json").exams;
const hash = value => createHash("sha256").update(value).digest("hex");
const fingerprint = value => hash(JSON.stringify(value));
const clean = text => text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const variants = text => text.split("/").flatMap(s => [s.trim().replace(/[（(]([^()（）]*)[)）]/g, "$1"), s.trim().replace(/[（(][^()（）]*[)）]/g, "")]);
const core = kanji1Characters(kanji[0]);
function source(ref) {
  assert.ok(ref.kind === "chapter" || ref.kind === "kanji");
  const pages = ref.kind === "chapter" ? chapters : kanji;
  assert.ok(Number(ref.id) <= (ref.kind === "chapter" ? 10 : 1));
  assert.ok(["lessons", "vocab"].includes(ref.section));
  const html = pages.find(p => p.ch === ref.id).sections.find(s => s.id === ref.section).html;
  const block = html.split(/(?=<h3\b)/).find(s => s.includes('id="' + ref.heading + '"'));
  assert.ok(block, ref.heading);
  if (ref.cells) {
    const rows = [...block.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs)].map(m => [...m[1].matchAll(/<td\b[^>]*>(.*?)<\/td>/gs)].map(c => clean(c[1]))).filter(row => row.length);
    assert.deepEqual(rows[ref.row], ref.cells, ref.heading);
  }
  if (ref.quote) assert.ok([...block.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].some(m => clean(m[1]) === ref.quote), ref.heading);
  return ref.cells;
}
function verifyPair(pair) {
  const cells = source(pair.source);
  assert.equal(pair.source.kind, "kanji");
  assert.equal(pair.source.id, "1");
  assert.equal(cells[0], pair.word);
  assert.equal(cells[1], pair.reading);
  for (const character of pair.word.match(/[\p{Script=Han}々]/gu) ?? []) assert.ok(core.includes(character), pair.word);
}

test("both revised exams keep 40 questions and all 80 items have reviewed fingerprints and real prerequisite evidence", () => {
  assert.equal(audit.questions.length, 80);
  for (const exam of bank.filter(e => e.id !== "chapter-5")) {
    assert.equal(exam.revision, 2);
    assert.equal(checkpointQuestions(exam).length, 40);
    for (const part of exam.parts) for (const q of part.questions) {
      const record = audit.questions.find(item => item.id === q.id);
      assert.equal(record.exam, exam.id);
      assert.equal(record.revision, exam.revision);
      assert.equal(record.format, part.id);
      assert.equal(record.questionSha256, fingerprint(q), q.id + " needs a fresh content review");
      const primary = record.vocabulary ?? record.grammar;
      source(primary);
      assert.equal(primary.kind, "chapter");
      assert.equal(primary.id, q.chapter);
      assert.equal(primary.heading, q.source.heading);
      for (const example of record.examples ?? []) source(example);
      for (const rule of record.grammarRules ?? []) source(rule);
      if (record.grammar) assert.equal(record.grammar.quote, q.source.evidence);
    }
  }
});

test("every reading target and written alternative is an actual Kanji 1 word/reading pair using the core characters", () => {
  const exam = bank.find(e => e.id === "vocabulary");
  assert.deepEqual(exam.parts.map(p => p.questions.length), [4, 4, 24, 8]);
  for (const part of exam.parts.slice(0, 2)) for (const q of part.questions) {
    const record = audit.questions.find(item => item.id === q.id);
    const answer = q.choices.find(c => c.id === q.correctChoiceId).text;
    record.kanjiPairs.forEach(verifyPair);
    const writtenTarget = part.id === "reading" ? q.target : answer;
    assert.equal(q.source.kanjiHeading, record.kanjiPairs.find(pair => pair.word === writtenTarget).source.heading);
    if (part.id === "reading") {
      assert.equal(record.kanjiPairs.length, 1);
      assert.equal(record.kanjiPairs[0].word, q.target);
      assert.equal(record.kanjiPairs[0].reading, answer);
    } else {
      assert.deepEqual(record.kanjiPairs.map(pair => pair.word), q.choices.map(c => c.text));
      assert.equal(record.kanjiPairs.find(pair => pair.word === answer).reading, q.target);
    }
  }
  const pairs = audit.questions.flatMap(q => q.kanjiPairs ?? []);
  assert.equal(pairs.length, 20);
  const wrongReading = structuredClone(pairs[0]); wrongReading.reading = "にほんご";
  assert.throws(() => verifyPair(wrongReading));
  const outOfScope = structuredClone(pairs[0]); outOfScope.word = "学生";
  assert.throws(() => verifyPair(outOfScope));
});

test("all vocabulary targets and single-word distractors are backed by printed teaching entries", () => {
  const exam = bank.find(e => e.id === "vocabulary");
  for (const part of exam.parts) for (const q of part.questions) {
    const record = audit.questions.find(item => item.id === q.id);
    const cells = source(record.vocabulary);
    if (q.number === 2) assert.ok(cells[0].includes(record.testedReading));
    else assert.ok(variants(cells[0]).includes(record.testedReading), q.id);
    if (["reading", "context"].includes(part.id)) {
      assert.equal(record.choiceWords.length, 4);
      for (const word of record.choiceWords) {
        assert.equal(q.choices.find(c => c.id === word.choiceId).text, word.word);
        const cells = source(word.source), kana = cells[word.source.kind === "kanji" ? 1 : 0];
        assert.ok(variants(kana).includes(word.word), q.id + ": " + word.word);
      }
    }
    if (["context", "paraphrase"].includes(part.id)) {
      assert.doesNotMatch(q.prompt + q.choices.map(c => c.text).join(""), /[\p{Script=Han}々]/u);
    }
  }
});

test("the later grammar sample includes distinct plain-form skills and the context pair really tests an adverb", () => {
  const questions = checkpointQuestions(bank.find(e => e.id === "grammar"));
  const expected = new Map([[23,"あそんだ"],[24,"こなかった"],[32,"した"],[38,"なかった"],[39,"たべない"],[40,"しなかった"]]);
  for (const [number, answer] of expected) {
    const q = questions.find(q => q.number === number);
    assert.equal(q.chapter, "10");
    assert.equal(q.choices.find(c => c.id === q.correctChoiceId).text, answer);
  }
  const adverb = questions.find(q => q.number === 35);
  assert.equal(adverb.choices.find(c => c.id === adverb.correctChoiceId).text, "はやく");
  assert.match(adverb.source.heading, /i-adjective-as-an-adverb/);
  assert.equal(adverb.passage.text, questions.find(q => q.number === 36).passage.text);
  assert.equal(questions.find(q => q.number === 39).passage.text, questions.find(q => q.number === 40).passage.text);
});

test("source lessons, Kanji 1 and the complete Chapter 5 exam are unchanged", () => {
  assert.equal(hash(bytes("src/data/chapters.json")), audit.sources.chaptersSha256);
  assert.equal(hash(bytes("src/data/kanji.json")), audit.sources.kanjiSha256);
  assert.equal(core, audit.policy.coreCharacters);
  const chapter5 = bank.find(e => e.id === "chapter-5");
  assert.equal(chapter5.revision, 1);
  assert.equal(fingerprint(chapter5), audit.sources.chapter5Sha256);
});

for (const old of archive) test(old.id + ": old scores remain under v1, new answers use v2 and wrong-revision data is rejected", () => {
  const exam = bank.find(e => e.id === old.id);
  const oldFirst = checkpointQuestions(old)[0];
  const submitted = submitCheckpointAttempt(old, { ...newCheckpointAttempt(old), answers: { [oldFirst.id]: oldFirst.correctChoiceId } }, "2026-10-21T12:00:00Z");
  const raw = JSON.stringify(submitted), storage = new Map([[checkpointKey(old), raw]]);
  const store = createCheckpointStore(exam, { getStorage: () => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }) });
  const stop = store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot().state, newCheckpointAttempt(exam));
  const first = checkpointQuestions(exam)[0];
  store.update(state => chooseCheckpointAnswer(exam, state, first.id, first.correctChoiceId));
  assert.equal(storage.get(checkpointKey(old)), raw);
  assert.equal(JSON.parse(storage.get(checkpointKey(exam))).examRevision, 2);
  assert.deepEqual(parseCheckpointAttempt(exam, raw), newCheckpointAttempt(exam));
  stop();
});
