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
const chapters = read("src/data/chapters.json"), chapter = chapters.find(c => c.ch === "15");
const sets = read("src/data/workbook-exercises.json").chapters.find(c => c.chapter === "15").sets;
const questions = sets.flatMap(s => s.questions), audit = read("migration/chapter-15-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = text => /[\p{Script=Han}々]/u.test(text);
const set = id => sets.find(s => s.id === id).questions;

test("Chapter 15 follows Chapter 14 with the same five sections and every sentence pattern in the outline", () => {
  assert.deepEqual(chapters.slice(0, 15).map(c => c.ch), Array.from({ length: 15 }, (_, i) => String(i + 1)));
  for (const previous of chapters.slice(0, 14)) assert.equal(hash(previous), audit.previousChapterHashes[previous.ch]);
  assert.equal(hash(chapter), audit.chapterSha256);
  assert.equal(chapter.title, "After, Listing Actions, Only and Not At All");
  assert.deepEqual(chapter.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  const patterns = chapter.toc.map(t => t.t).filter(t => t.startsWith("ぶんけい"));
  assert.deepEqual(patterns.map(t => t.split(" ")[1]), Array.from({ length: 6 }, (_, i) => "15." + (i + 1)));
  assert.equal(audit.vocabularyCount, 28);
});

test("all 76 workbook questions are in nine source-linked sets with reviewed keys", () => {
  assert.deepEqual(sets.map(s => s.questions.length), [20, 10, 10, 8, 8, 3, 2, 10, 5]);
  assert.equal(new Set(questions.map(q => q.id)).size, 76);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../src/data/workbook-exercises.json", import.meta.url))).digest("hex"), audit.questionDataSha256);
  const html = chapter.sections.find(s => s.id === "exercises").html;
  for (const s of sets) {
    assert.ok(html.includes('data-workbook-set="' + s.id + '"') && html.includes('id="' + s.heading + '"'));
    assert.deepEqual(s.questions.map(q => q.number), Array.from({ length: s.questions.length }, (_, i) => i + 1));
    assert.deepEqual(audit.sets.find(a => a.id === s.id).questions.map(q => q.model), s.questions.map(q => q.model));
    for (const q of s.questions) assert.ok(q.model && q.whyEn && q.source.printedPage === s.sourcePage);
  }
  for (const [id, expected] of [["c15-grammar-choices", "24213343"], ["c15-text-grammar", "411"], ["c15-reading-comprehension", "23"]]) {
    const qs = set(id);
    assert.equal(qs.map(q => q.correctChoiceId).join(""), expected);
    for (const q of qs) assert.equal(gradeWorkbook(q, q.correctChoiceId), "correct");
  }
  assert.equal(questions.filter(q => q.mode === "self").length, 15);
});

test("typed answers accept the model, kana and the documented alternatives, and keep grammar distinctions", () => {
  for (const q of questions.filter(q => q.mode === "text")) {
    assert.equal(gradeWorkbook(q, q.model), "correct", q.id);
    assert.equal(gradeWorkbook(q, ""), "blank");
  }
  const forms = set("c15-verb-forms");
  assert.deepEqual(forms.map(q => q.model.split(" ")[1]), ["のんだ","あらった","のぼった","つかった","みがいた","ねた","あびた","かした","かえした","つくった","わかった","えらんだ","ひいた","わすれた","はじまった","やすんだ","おいた","おきた","きった","きた"]);
  assert.equal(gradeWorkbook(forms[1], "あらわない、あらった"), "correct");
  assert.equal(gradeWorkbook(forms[1], "あらない あらった"), "incorrect");
  assert.equal(gradeWorkbook(forms[18], "きない きた"), "correct");
  assert.equal(gradeWorkbook(forms[19], "きない きた"), "incorrect");
  const ato = set("c15-ato-forms");
  assert.equal(gradeWorkbook(ato[0], "クラスが おわったあと スーパーに いきます"), "correct");
  assert.equal(gradeWorkbook(ato[1], "いっかげつご くにへ もどります。"), "correct");
  assert.equal(gradeWorkbook(ato[5], "しごとの あとで ともだちと あそびます"), "correct");
  assert.equal(gradeWorkbook(ato[0], "クラスが おわるあとで スーパーへ いきます"), "incorrect");
  const tari = set("c15-tari-forms");
  assert.equal(gradeWorkbook(tari[2], "からおけへ いったり いえで れんしゅうしたり します"), "incorrect");
  assert.equal(gradeWorkbook(tari[2], "カラオケへ いったり いえで れんしゅうしたり します"), "correct");
  assert.equal(gradeWorkbook(tari[2], "カラオケへ いきたり いえで れんしゅうしたり します"), "incorrect");
  for (const q of set("c15-word-order")) {
    assert.equal(q.tokens.length, 4);
    assert.equal(normalizeWorkbook((q.before ?? "") + q.acceptedOrders[0].map(i => q.tokens[i]).join("") + q.after), normalizeWorkbook(q.model));
    for (const order of q.acceptedOrders) assert.equal(gradeWorkbook(q, order.join(",")), "correct");
  }
});

test("kanji appear only where the book prints them, each with a reviewed reading; headings stay in English and kana", () => {
  const page = furiganaPage(read("src/data/furigana.json"), "chapter/15/lessons");
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
  for (const query of ["zenzen", "あとで", "refrigerator", "not at all"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "15" }).length, query);
  const examples = collectFlashcardExamples(chapter.sections, { kind: "chapter", id: "15" });
  const cards = chapter.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "chapter", id: "15", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.ok(cards.some(c => c.japanese === "およいだ" && c.meaning === "swim (た form)"));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "れいぞうこ" && c.meaning === "refrigerator"));
  assert.ok(cards.some(c => c.kind === "sentence" && c.japanese === "中国語が ぜんぜん 話せません。"));
  assert.ok(cards.filter(c => c.kind === "sentence").length > 50);
  assert.ok(cards.every(c => c.source.href.startsWith("/chapters/15#")));
});
