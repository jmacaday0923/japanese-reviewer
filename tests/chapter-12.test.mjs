import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gradeWorkbook, normalizeWorkbook } from "../src/lib/workbook.ts";
import { buildSearchIndex, searchGroups } from "../src/lib/search.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { collectFlashcardExamples, sectionFlashcards } from "../src/lib/flashcard-content.ts";
import { furiganaPage, furiganaParts } from "../src/lib/furigana.ts";
const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const chapters = read("src/data/chapters.json"), chapter = chapters.find(c => c.ch === "12");
const sets = read("src/data/workbook-exercises.json").chapters.find(c => c.chapter === "12").sets;
const questions = sets.flatMap(s => s.questions), audit = read("migration/chapter-12-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = text => /[\p{Script=Han}々]/u.test(text);

test("Chapter 12 follows Chapter 11 with the same five sections and every sentence pattern in the outline", () => {
  assert.deepEqual(chapters.map(c => c.ch), Array.from({ length: 12 }, (_, i) => String(i + 1)));
  for (const previous of chapters.slice(0, 11)) assert.equal(hash(previous), audit.previousChapterHashes[previous.ch]);
  assert.equal(hash(chapter), audit.chapterSha256);
  assert.equal(chapter.title, "Reason, Volitional Form, Parts of the Body");
  assert.deepEqual(chapter.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  const patterns = chapter.toc.map(t => t.t).filter(t => t.startsWith("ぶんけい"));
  assert.deepEqual(patterns.map(t => t.split(" ")[1]), Array.from({ length: 10 }, (_, i) => "12." + (i + 1)));
  assert.equal(audit.vocabularyCount, 33);
});

test("all 51 workbook questions are in eight source-linked sets with reviewed keys", () => {
  assert.deepEqual(sets.map(s => s.questions.length), [6, 10, 8, 8, 3, 2, 10, 4]);
  assert.equal(new Set(questions.map(q => q.id)).size, 51);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../src/data/workbook-exercises.json", import.meta.url))).digest("hex"), audit.questionDataSha256);
  const html = chapter.sections.find(s => s.id === "exercises").html;
  for (const set of sets) {
    assert.ok(html.includes('data-workbook-set="' + set.id + '"') && html.includes('id="' + set.heading + '"'));
    assert.deepEqual(set.questions.map(q => q.source.number), Array.from({ length: set.questions.length }, (_, i) => i + 1));
    assert.deepEqual(audit.sets.find(s => s.id === set.id).questions.map(q => q.model), set.questions.map(q => q.model));
    for (const q of set.questions) assert.ok(q.model && q.whyEn);
  }
  for (const [id, expected] of [["c12-reason-choices", "decbfa"], ["c12-grammar-choices", "23432434"], ["c12-text-grammar", "343"], ["c12-reading-comprehension", "43"]]) {
    const qs = sets.find(s => s.id === id).questions;
    assert.equal(qs.map(q => q.correctChoiceId).join(""), expected);
    for (const q of qs) assert.equal(gradeWorkbook(q, q.correctChoiceId), "correct");
  }
  assert.equal(questions.filter(q => q.mode === "self").length, 14);
});

test("volitional answers take the polite ましょう form, and word tiles rebuild the printed sentence", () => {
  const forms = sets.find(s => s.id === "c12-volitional-forms").questions;
  assert.deepEqual(forms.map(q => q.model), ["もどりましょう","ききましょう","はなしましょう","よみましょう","かいものしましょう","はらいましょう","だしましょう","つくりましょう","べんきょうしましょう","かえしましょう"]);
  for (const q of forms) { assert.equal(gradeWorkbook(q, q.model), "correct"); assert.equal(gradeWorkbook(q, ""), "blank"); }
  assert.equal(gradeWorkbook(forms[0], "もどろう"), "incorrect");
  for (const q of sets.find(s => s.id === "c12-word-order").questions) {
    assert.equal(q.tokens.length, 4);
    for (const order of q.acceptedOrders) {
      assert.equal(gradeWorkbook(q, order.join(",")), "correct");
      assert.equal(normalizeWorkbook(q.before + order.map(i => q.tokens[i]).join("") + q.after), normalizeWorkbook(q.model));
    }
  }
});

test("kanji appear only where the book prints them, each with a reviewed reading; headings stay in English and kana", () => {
  const page = furiganaPage(read("src/data/furigana.json"), "chapter/12/lessons");
  const texts = [chapter.intro, ...chapter.sections.flatMap(s => s.html.replace(/<[^>]+>/g, "\n").split("\n"))];
  for (const set of sets) for (const q of set.questions)
    texts.push(q.prompt, q.model, q.whyEn, q.before ?? "", q.after ?? "", ...(q.tokens ?? []), ...(q.choices ?? []).map(c => c.text));
  let readings = 0;
  for (const text of texts) readings += furiganaParts(text, page).filter(p => p.reading).length;
  assert.ok(readings > 300);
  for (const text of [chapter.intro, ...chapter.toc.map(t => t.t), ...sets.flatMap(s => [s.title, s.instructionsJa, s.instructionsEn])]) assert.ok(!kanji(text), text);
  for (const s of chapter.sections) for (const m of s.html.matchAll(/<(h3|h4|p)( [^>]*)?>([^<]*)<\/\1>/g))
    if (!(m[2] ?? "").includes('lang="ja"')) assert.ok(!kanji(m[3]), m[3]);
});

test("two reading passages start with closed support; search and flashcards include the chapter", () => {
  const html = chapter.sections.find(s => s.id === "exercises").html;
  assert.equal((html.match(/data-reading-exercise=/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  const index = buildSearchIndex([{ kind: "chapter", label: "Chapter", basePath: "/chapters", pages: [chapter] }]);
  for (const query of ["dokoka", "なにも", "oversleeping", "let's eat"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "12" }).length, query);
  const examples = collectFlashcardExamples(chapter.sections, { kind: "chapter", id: "12" });
  const cards = chapter.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "chapter", id: "12", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.ok(cards.some(c => c.japanese === "こよう" && c.meaning === "let's come"));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "かりる"));
  assert.ok(cards.filter(c => c.kind === "sentence").length > 100);
  assert.ok(cards.every(c => c.source.href.startsWith("/chapters/12#")));
});
