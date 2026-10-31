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
const chapters = read("src/data/chapters.json"), chapter = chapters.find(c => c.ch === "14");
const sets = read("src/data/workbook-exercises.json").chapters.find(c => c.chapter === "14").sets;
const questions = sets.flatMap(s => s.questions), audit = read("migration/chapter-14-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = text => /[\p{Script=Han}々]/u.test(text);
const set = id => sets.find(s => s.id === id).questions;

test("Chapter 14 follows Chapter 13 with the same five sections and every sentence pattern in the outline", () => {
  assert.deepEqual(chapters.slice(0, 14).map(c => c.ch), Array.from({ length: 14 }, (_, i) => String(i + 1)));
  for (const previous of chapters.slice(0, 13)) assert.equal(hash(previous), audit.previousChapterHashes[previous.ch]);
  assert.equal(hash(chapter), audit.chapterSha256);
  assert.equal(chapter.title, "Clothing, Before, Plans and But");
  assert.deepEqual(chapter.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  const patterns = chapter.toc.map(t => t.t).filter(t => t.startsWith("ぶんけい"));
  assert.deepEqual(patterns.map(t => t.split(" ")[1]), Array.from({ length: 7 }, (_, i) => "14." + (i + 1)));
  assert.equal(audit.vocabularyCount, 31);
});

test("all 80 workbook questions are in nine source-linked sets with reviewed keys", () => {
  assert.deepEqual(sets.map(s => s.questions.length), [20, 9, 16, 8, 8, 3, 2, 10, 4]);
  assert.equal(new Set(questions.map(q => q.id)).size, 80);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../src/data/workbook-exercises.json", import.meta.url))).digest("hex"), audit.questionDataSha256);
  const html = chapter.sections.find(s => s.id === "exercises").html;
  for (const s of sets) {
    assert.ok(html.includes('data-workbook-set="' + s.id + '"') && html.includes('id="' + s.heading + '"'));
    assert.deepEqual(s.questions.map(q => q.number), Array.from({ length: s.questions.length }, (_, i) => i + 1));
    assert.deepEqual(audit.sets.find(a => a.id === s.id).questions.map(q => q.model), s.questions.map(q => q.model));
    for (const q of s.questions) assert.ok(q.model && q.whyEn && q.source.printedPage === s.sourcePage);
  }
  // Two questions for each printed line: put on and take off, or positive and negative.
  assert.deepEqual(set("c14-wearing-verbs").map(q => q.source.number), Array.from({ length: 20 }, (_, i) => Math.floor(i / 2) + 1));
  assert.deepEqual(set("c14-tsumori").map(q => q.source.number), Array.from({ length: 16 }, (_, i) => Math.floor(i / 2) + 1));
  for (const [id, expected] of [["c14-grammar-choices", "33322441"], ["c14-text-grammar", "243"], ["c14-reading-comprehension", "41"]]) {
    const qs = set(id);
    assert.equal(qs.map(q => q.correctChoiceId).join(""), expected);
    for (const q of qs) assert.equal(gradeWorkbook(q, q.correctChoiceId), "correct");
  }
  assert.equal(questions.filter(q => q.mode === "self").length, 14);
});

test("typed answers accept the model, kana and the documented alternatives, and keep grammar distinctions", () => {
  for (const q of questions.filter(q => q.mode === "text")) {
    assert.equal(gradeWorkbook(q, q.model), "correct", q.id);
    assert.equal(gradeWorkbook(q, ""), "blank");
  }
  const wearing = set("c14-wearing-verbs");
  assert.deepEqual(wearing.map(q => q.model.split(" ").at(-1)), ["します。","はずします。","かぶります。","はずします。","はきます。","ぬぎます。","します。","はずします。","かけます。","はずします。","きます。","ぬぎます。","しめます。","はずします。","はきます。","ぬぎます。","きます。","ぬぎます。","はきます。","ぬぎます。"]);
  assert.equal(gradeWorkbook(wearing[0], "します"), "correct");
  assert.equal(gradeWorkbook(wearing[3], "ぬぎます"), "correct");
  assert.equal(gradeWorkbook(wearing[10], "うわぎを 着ます。"), "correct");
  assert.equal(gradeWorkbook(wearing[10], "はきます"), "incorrect");
  assert.equal(gradeWorkbook(wearing[9], "ぬぎます"), "incorrect");
  const maeni = set("c14-mae-ni");
  assert.equal(gradeWorkbook(maeni[2], "くるまえに ともだちに でんわを かけます"), "correct");
  assert.equal(gradeWorkbook(maeni[6], "ねるまえに ほんを よみました。"), "correct");
  assert.equal(gradeWorkbook(maeni[6], "ねたまえに ほんを よみました。"), "incorrect");
  const tsumori = set("c14-tsumori");
  assert.equal(gradeWorkbook(tsumori[2], "かうつもりです"), "correct");
  assert.equal(gradeWorkbook(tsumori[3], "あたらしいカメラを かわないつもりだ"), "correct");
  assert.equal(gradeWorkbook(tsumori[3], "かうつもりです"), "incorrect");
  assert.equal(gradeWorkbook(tsumori[7], "かりないつもりです"), "correct");
  for (const q of set("c14-word-order")) {
    assert.equal(q.tokens.length, 4);
    for (const order of q.acceptedOrders) {
      assert.equal(gradeWorkbook(q, order.join(",")), "correct");
      assert.equal(normalizeWorkbook((q.before ?? "") + order.map(i => q.tokens[i]).join("") + q.after), normalizeWorkbook(q.model));
    }
  }
});

test("kanji appear only where the book prints them, each with a reviewed reading; headings stay in English and kana", () => {
  const page = furiganaPage(read("src/data/furigana.json"), "chapter/14/lessons");
  const texts = [chapter.intro, ...chapter.sections.flatMap(s => s.html.replace(/<[^>]+>/g, "\n").split("\n"))];
  for (const s of sets) for (const q of s.questions)
    texts.push(q.prompt, q.model, q.whyEn, q.before ?? "", q.after ?? "", ...(q.tokens ?? []), ...(q.choices ?? []).map(c => c.text));
  let readings = 0;
  for (const text of texts) readings += furiganaParts(text, page).filter(p => p.reading).length;
  assert.ok(readings > 250);
  for (const text of [chapter.intro, ...chapter.toc.map(t => t.t), ...sets.flatMap(s => [s.title, s.instructionsJa, s.instructionsEn])]) assert.ok(!kanji(text), text);
  for (const s of chapter.sections) for (const m of s.html.matchAll(/<(h3|h4|p)( [^>]*)?>([^<]*)<\/\1>/g))
    if (!(m[2] ?? "").includes('lang="ja"')) assert.ok(!kanji(m[3]), m[3]);
});

test("two reading passages start with closed support; search and flashcards include the chapter", () => {
  const html = chapter.sections.find(s => s.id === "exercises").html;
  assert.equal((html.match(/data-reading-exercise=/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  const index = buildSearchIndex([{ kind: "chapter", label: "Chapter", basePath: "/chapters", pages: [chapter] }]);
  for (const query of ["tsumori", "まえに", "necktie", "plan to"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "14" }).length, query);
  const examples = collectFlashcardExamples(chapter.sections, { kind: "chapter", id: "14" });
  const cards = chapter.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "chapter", id: "14", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "かぶる" && c.meaning === "put on (hat)"));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "ネクタイ" && c.meaning === "necktie"));
  assert.ok(cards.some(c => c.kind === "sentence" && c.japanese === "バスに のるまえに きっぷを 買います。"));
  assert.ok(cards.filter(c => c.kind === "sentence").length > 40);
  assert.ok(cards.every(c => c.source.href.startsWith("/chapters/14#")));
});
