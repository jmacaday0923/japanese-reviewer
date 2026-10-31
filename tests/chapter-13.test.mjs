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
const chapters = read("src/data/chapters.json"), chapter = chapters.find(c => c.ch === "13");
const sets = read("src/data/workbook-exercises.json").chapters.find(c => c.chapter === "13").sets;
const questions = sets.flatMap(s => s.questions), audit = read("migration/chapter-13-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = text => /[\p{Script=Han}々]/u.test(text);
const set = id => sets.find(s => s.id === id).questions;

test("Chapter 13 follows Chapter 12 with the same five sections and every sentence pattern in the outline", () => {
  assert.deepEqual(chapters.slice(0, 13).map(c => c.ch), Array.from({ length: 13 }, (_, i) => String(i + 1)));
  for (const previous of chapters.slice(0, 12)) assert.equal(hash(previous), audit.previousChapterHashes[previous.ch]);
  assert.equal(hash(chapter), audit.chapterSha256);
  assert.equal(chapter.title, "Stem Form, Want To, Purpose and While");
  assert.deepEqual(chapter.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  const patterns = chapter.toc.map(t => t.t).filter(t => t.startsWith("ぶんけい"));
  assert.deepEqual(patterns.map(t => t.split(" ")[1]), ["13.1", "13.2", "13.3", "13.4"]);
  assert.equal(audit.vocabularyCount, 30);
});

test("all 88 workbook questions are in ten source-linked sets with reviewed keys", () => {
  assert.deepEqual(sets.map(s => s.questions.length), [18, 14, 10, 10, 8, 8, 3, 2, 10, 5]);
  assert.equal(new Set(questions.map(q => q.id)).size, 88);
  assert.equal(createHash("sha256").update(readFileSync(new URL("../src/data/workbook-exercises.json", import.meta.url))).digest("hex"), audit.questionDataSha256);
  const html = chapter.sections.find(s => s.id === "exercises").html;
  for (const s of sets) {
    assert.ok(html.includes('data-workbook-set="' + s.id + '"') && html.includes('id="' + s.heading + '"'));
    assert.deepEqual(s.questions.map(q => q.number), Array.from({ length: s.questions.length }, (_, i) => i + 1));
    assert.deepEqual(audit.sets.find(a => a.id === s.id).questions.map(q => q.model), s.questions.map(q => q.model));
    for (const q of s.questions) assert.ok(q.model && q.whyEn && q.source.printedPage === s.sourcePage);
  }
  // The たい exercise has a たい line and a たくない line for each of its seven printed sentences.
  assert.deepEqual(set("c13-tai-forms").map(q => q.source.number), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  for (const [id, expected] of [["c13-grammar-choices", "11133224"], ["c13-text-grammar", "132"], ["c13-reading-comprehension", "24"]]) {
    const qs = set(id);
    assert.equal(qs.map(q => q.correctChoiceId).join(""), expected);
    for (const q of qs) assert.equal(gradeWorkbook(q, q.correctChoiceId), "correct");
  }
  assert.equal(gradeWorkbook(set("c13-grammar-choices")[3], "4"), "correct");
  assert.equal(questions.filter(q => q.mode === "self").length, 15);
});

test("typed answers accept the model, kana and the documented alternatives, and keep grammar distinctions", () => {
  for (const q of questions.filter(q => q.mode === "text")) {
    assert.equal(gradeWorkbook(q, q.model), "correct", q.id);
    assert.equal(gradeWorkbook(q, ""), "blank");
  }
  const stems = set("c13-stem-forms");
  assert.deepEqual(stems.map(q => q.model.split(" ")[1]), ["とまり","のり","あい","のみ","べんきょうし","やすみ","おき","はいり","すみ","つとめ","おき","ね","いき","せんたくし","き","よみ","うり","かい"]);
  assert.equal(gradeWorkbook(stems[0], "とまる、とまり"), "correct");
  assert.equal(gradeWorkbook(stems[9], "はたらく はたらき"), "correct");
  assert.equal(gradeWorkbook(stems[7], "はいる はい"), "incorrect");
  const tai = set("c13-tai-forms");
  assert.equal(gradeWorkbook(tai[0], "かいものしたいです"), "correct");
  assert.equal(gradeWorkbook(tai[0], "どようびに かいものしたいです。"), "correct");
  assert.equal(gradeWorkbook(tai[1], "かいものしたくありません"), "correct");
  assert.equal(gradeWorkbook(tai[1], "かいものしたいです"), "incorrect");
  assert.equal(gradeWorkbook(tai[10], "みたいです"), "correct");
  const purpose = set("c13-purpose");
  assert.equal(gradeWorkbook(purpose[0], "ジョンさんは にほんに えいごを おしえに いきます"), "correct");
  assert.equal(gradeWorkbook(purpose[2], "デパートへ かいものを しに 行きます。"), "correct");
  assert.equal(gradeWorkbook(purpose[0], "ジョンさんは 日本へ えいごを おしえて 行きます。"), "incorrect");
  assert.equal(gradeWorkbook(set("c13-nagara")[1], "にほんごを べんきょうしながら アルバイトを します"), "incorrect");
  for (const q of set("c13-word-order")) {
    assert.equal(q.tokens.length, 4);
    for (const order of q.acceptedOrders) {
      assert.equal(gradeWorkbook(q, order.join(",")), "correct");
      assert.equal(normalizeWorkbook((q.before ?? "") + order.map(i => q.tokens[i]).join("") + q.after), normalizeWorkbook(q.model));
    }
  }
});

test("kanji appear only where the book prints them, each with a reviewed reading; headings stay in English and kana", () => {
  const page = furiganaPage(read("src/data/furigana.json"), "chapter/13/lessons");
  const texts = [chapter.intro, ...chapter.sections.flatMap(s => s.html.replace(/<[^>]+>/g, "\n").split("\n"))];
  for (const s of sets) for (const q of s.questions)
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
  for (const query of ["nagara", "たべたい", "envelope", "while watching"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "13" }).length, query);
  const examples = collectFlashcardExamples(chapter.sections, { kind: "chapter", id: "13" });
  const cards = chapter.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "chapter", id: "13", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "ふうとう" && c.meaning === "envelope"));
  assert.ok(cards.some(c => c.kind === "sentence" && c.japanese === "電車に のりながら、おんがくを 聞きます。"));
  assert.ok(cards.some(c => c.japanese === "あそび" && c.meaning === "play; go out (stem form)"));
  assert.ok(cards.filter(c => c.kind === "sentence").length > 40);
  assert.ok(cards.every(c => c.source.href.startsWith("/chapters/13#")));
});
