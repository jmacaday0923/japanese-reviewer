import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildSearchIndex, searchGroups } from "../src/lib/search.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { collectFlashcardExamples, sectionFlashcards } from "../src/lib/flashcard-content.ts";
const read = path => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const pages = read("src/data/kanji.json"), page = pages.find(p => p.ch === "4"), audit = read("migration/kanji-4-audit.json");
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const html = id => page.sections.find(s => s.id === id).html;
const text = cell => cell.replace(/<[^>]+>/g, "");
function parts(section) {
  const out = new Map();
  for (const m of html(section).matchAll(/<h3 id="[^"]+">Part ([A-J]):[^<]*<\/h3>(?:<p>[^<]*<\/p>)?<div class="tw"><table>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g))
    out.set(m[1], [...m[2].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => text(c[1]))));
  return out;
}

test("Kanji 4 follows Kanji 3 and leaves Kanji 1 to 3 unchanged", () => {
  // Later Kanji pages are appended after Kanji 4.
  assert.deepEqual(pages.slice(0, 4).map(p => p.ch), ["1", "2", "3", "4"]);
  for (const previous of pages.slice(0, 3)) assert.equal(hash(previous), audit.previousPageHashes[previous.ch]);
  assert.equal(hash(page), audit.pageSha256);
  assert.equal(page.title, "Verbs, Words and Places in Town");
  assert.deepEqual(page.sections.map(s => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  assert.deepEqual(page.toc.map(t => t.a), [...new Set(page.toc.map(t => t.a))]);
});

test("all 30 workbook kanji, 91 to 120, each with readings, strokes and example words", () => {
  const kanji = [...html("lessons").matchAll(/<h3 id="[^"]+">(.) \(/g)].map(m => m[1]);
  assert.equal(kanji.join(""), audit.kanji);
  assert.equal(kanji.join(""), "入出止切立持待閉開聞知学会着使作言語話読店校国家車道駅京都方");
  const earlier = pages.slice(0, 3).flatMap(p => [...p.sections[0].html.matchAll(/<h3 id="[^"]+">(.) \(/g)].map(m => m[1]));
  assert.ok(kanji.every(k => !earlier.includes(k)), "no kanji repeats Kanji 1 to 3");
  const blocks = html("lessons").split(/<h3 /).slice(2);
  assert.equal(blocks.length, 30);
  for (const block of blocks) {
    assert.match(block, /<th>Meaning<\/th><th>On'yomi<\/th><th>Kun'yomi<\/th><th>Strokes<\/th>/);
    assert.match(block, /<td>\d+<\/td><\/tr><\/tbody>/);
    assert.match(block, /<th>Word<\/th><th>Kana<\/th><th>Romaji<\/th><th>English<\/th>/);
  }
  assert.doesNotMatch(html("lessons"), /\(special\)/);
  assert.match(html("lessons"), /閉 \(close\)/);
  assert.match(html("lessons"), /学校<\/td><td>がっこう/);
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
  assert.equal(ans.get("C")[0][1], "ききます (choice 3)");
  assert.equal(ans.get("D")[29][1], "校長 (choice 1)");
  assert.match(html("answers"), /They are model answers, not the official answer key\./);
});

test("search and flashcards include Kanji 4", () => {
  const index = buildSearchIndex([{ kind: "kanji", label: "Kanji", basePath: "/kanji", pages: [page] }]);
  for (const query of ["densha", "ものがたり", "water supply", "東京都"]) assert.ok(searchGroups(index, { q: query, category: "all", chapter: "kanji" }).length, query);
  const examples = collectFlashcardExamples(page.sections, { kind: "kanji", id: "4" });
  const cards = page.sections.flatMap(section => sectionFlashcards(splitReadingContent(section.html), { kind: "kanji", id: "4", sectionId: section.id, sectionTitle: section.title }, examples).flatMap(b => (b.flashcards ?? []).filter(Boolean)));
  assert.equal(cards.filter(c => c.kind === "kanji" && /^\p{Script=Han}$/u.test(c.japanese)).length, 30);
  assert.ok(cards.some(c => c.japanese === "上着" && c.kana === "うわぎ"));
  assert.ok(cards.some(c => c.kind === "vocabulary" && c.japanese === "閉まる" && c.meaning === "to close (by itself)"));
  assert.ok(cards.every(c => c.source.href.startsWith("/kanji/4#")));
});
