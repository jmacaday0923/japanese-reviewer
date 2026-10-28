import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildSearchIndex, searchGroups } from "../src/lib/search.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { collectFlashcardExamples, sectionFlashcards } from "../src/lib/flashcard-content.ts";
const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const pages = read("src/data/kanji.json"), page = pages.find(p => p.ch === "3"), audit = read("migration/kanji-3-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const html = id => page.sections.find(s => s.id === id).html;
const text = cell => cell.replace(/<[^>]+>/g, "");
function parts(section) {
  const out = new Map();
  for (const m of html(section).matchAll(/<h3 id="[^"]+">Part ([A-J]):[^<]*<\/h3>(?:<p>[^<]*<\/p>)?<div class="tw"><table>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g))
    out.set(m[1], [...m[2].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => text(c[1]))));
  return out;
}

test("Kanji 3 follows Kanji 2 and leaves Kanji 1 and 2 unchanged", () => {
  assert.deepEqual(pages.map(p => p.ch), ["1", "2", "3"]);
  for (const previous of pages.slice(0, 2)) assert.equal(hash(previous), audit.previousPageHashes[previous.ch]);
  assert.equal(hash(page), audit.pageSha256);
  assert.equal(page.title, "Adjectives, Colors and Everyday Verbs");
  assert.deepEqual(page.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  assert.deepEqual(page.toc.map(t => t.a), [...new Set(page.toc.map(t => t.a))]);
});

test("all 30 workbook kanji, 61 to 90, each with readings, strokes and example words", () => {
  const kanji = [...html("lessons").matchAll(/<h3 id="[^"]+">(.) \(/g)].map(m => m[1]);
  assert.equal(kanji.join(""), audit.kanji);
  assert.equal(kanji.join(""), "大小安高新古長早近明少多有名色白青赤茶黒書行食飲買見生休帰売");
  const earlier = pages.slice(0, 2).flatMap(p => [...p.sections[0].html.matchAll(/<h3 id="[^"]+">(.) \(/g)].map(m => m[1]));
  assert.ok(kanji.every(k => !earlier.includes(k)), "no kanji repeats Kanji 1 or 2");
  const blocks = html("lessons").split(/<h3 /).slice(2);
  assert.equal(blocks.length, 30);
  for (const block of blocks) {
    assert.match(block, /<th>Meaning<\/th><th>On'yomi<\/th><th>Kun'yomi<\/th><th>Strokes<\/th>/);
    assert.match(block, /<td>\d+<\/td><\/tr><\/tbody>/);
    assert.match(block, /<th>Word<\/th><th>Kana<\/th><th>Romaji<\/th><th>English<\/th>/);
  }
  assert.match(html("lessons"), /大人.*おとな.*adult \(special reading\)/s);
  assert.match(html("lessons"), /明日.*あした.*tomorrow \(special reading\)/s);
});

test("every exercise part has a matching answer part, and the test keys come from the workbook choices", () => {
  const expected = { A: 30, B: 30, C: 30, D: 30, E: 15, F: 15, G: 10, H: 8, I: 8, J: 8 };
  const ex = parts("exercises"), ans = parts("answers");
  for (const [letter, n] of Object.entries(expected)) {
    assert.equal(ex.get(letter)?.length, n, "Part " + letter + " questions");
    assert.equal(ans.get(letter)?.length, n, "Part " + letter + " answers");
  }
  for (const letter of ["C", "D"]) {
    const keys = ans.get(letter).map(row => /\(choice (\d)\)/.exec(row[1])[1]).join("");
    assert.equal(keys, audit.testKeys[letter], "Part " + letter);
  }
  assert.equal(ans.get("C")[0][1], "ちかい (choice 1)");
  assert.equal(ans.get("D")[29][1], "買いました (choice 1)");
  assert.match(html("answers"), /They are model answers, not the official answer key\./);
});

test("search and flashcards include Kanji 3", () => {
  const index = buildSearchIndex([{ kind: "kanji", label: "Kanji", basePath: "/kanji", pages: [page] }]);
  for (const query of ["akachan", "あおぞら", "sold out", "売店"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "kanji" }).length, query);
  const examples = collectFlashcardExamples(page.sections, { kind: "kanji", id: "3" });
  const cards = page.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "kanji", id: "3", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.equal(cards.filter(c => c.kind === "kanji" && /^\p{Script=Han}$/u.test(c.japanese)).length, 30);
  assert.ok(cards.some(c => c.japanese === "赤ちゃん" && c.kana === "あかちゃん"));
  assert.ok(cards.every(c => c.source.href.startsWith("/kanji/3#")));
});
