// Relevance and grouping regressions, including real library content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchIndex, matchEntries, normalizeSearchText, searchGroups, resultHref } from "../src/lib/search.ts";

const load = (file) => JSON.parse(readFileSync(new URL("../src/data/" + file + ".json", import.meta.url), "utf8"));
const sources = [
  { kind: "chapter", label: "Chapter", basePath: "/chapters", pages: load("chapters") },
  { kind: "kana", label: "Kana", basePath: "/kana", pages: load("kana") },
  { kind: "kanji", label: "Kanji", basePath: "/kanji", pages: load("kanji") },
  { kind: "practice", label: "Practice", basePath: "/practice", pages: load("practice") },
];
const library = buildSearchIndex(sources);
const state = (q, category = "all", chapter = "all") => ({ q, category, chapter });
const sample = (rows, headers = [["Kana", "Kanji", "Romaji", "English"]]) => ({
  pages: [{href: "/chapters/1", name: "Chapter 1"}, {href: "/kana/1", name: "Kana 1"}, {href: "/kanji/1", name: "Kanji 1"}],
  headers,
  entries: rows.map((row, id) => ({id, p: 0, a: "word-" + id, ch: "1", c: "vocab", b: "Vocabulary", h: 0, ...row})),
});
const ids = (groups) => groups.map((group) => group.entry.id);

for (const q of ["gakusei", "がくせい", "学生", "student", "  ＧＡＫＵＳＥＩ  "]) {
  test("real search: " + q + " puts the student definition first and keeps its chapter and kana sources", () => {
    const groups = searchGroups(library, state(q));
    assert.equal(groups[0].entry.x, "がくせい | 学生 | gakusei | student");
    assert.equal(groups[0].entry.c, "vocab");
    assert.deepEqual(groups[0].occurrences.map((entry) => library.pages[entry.p].href), ["/chapters/1", "/kana/1", "/kanji/3"]);
    if (normalizeSearchText(q) === "gakusei") {
      const example = groups.findIndex((group) => group.entry.c === "grammar");
      const partial = groups.findIndex((group) => group.entry.x.includes("ryuugakusei"));
      assert.ok(example > 0);
      assert.ok(partial > example, "a whole-word example beats a substring inside a different word");
    }
  });
}

test("exact script vocabulary beats earlier grammar and kana sound examples", () => {
  const index = sample([
    {c: "grammar", x: "わたしは がくせいです。 | watashi wa gakusei desu. | I am a student.", h: 1},
    {c: "script", ch: "kana", p: 1, x: "ga | が | gakusei example", h: 2},
    {c: "script", ch: "kanji", p: 2, x: "がくせい | 学生 | gakusei | student"},
  ], [["Kana", "Kanji", "Romaji", "English"], ["Japanese", "Romaji", "English"], ["Romaji", "Hiragana", "Example"]]);
  assert.deepEqual(ids(searchGroups(index, state("gakusei"))), [2, 0, 1]);
});

test("prefixes and word boundaries beat substrings, with deterministic source-order ties", () => {
  const index = sample([
    {x: "りゅうがくせい | 留学生 | ryuugakusei | international student"},
    {x: "がくせいです | 学生です | gakusei desu | I am a student"},
    {x: "がくせい | 学生 | gakusei | student"},
    {x: "べつ | 別 | something gakusei | another meaning"},
    {x: "ほか | 他 | another gakusei | different meaning"},
  ]);
  assert.deepEqual(ids(searchGroups(index, state("gakusei"))), [2, 1, 3, 4, 0]);
});

test("supplemental notes stay searchable but are not treated as exact headwords", () => {
  const index = sample([
    {x: "ほか | 他 | hoka | other | gakusei"},
    {x: "がくせい | 学生 | gakusei | student | noun"},
  ], [["Kana", "Kanji", "Romaji", "English", "Break"]]);
  assert.deepEqual(ids(searchGroups(index, state("gakusei"))), [1, 0]);
});

test("repeated definitions group across pages while every occurrence and original entry survives", () => {
  const index = sample([
    {x: "がくせい | 学生 | gakusei | student"},
    {x: "がくせい | 学生 | GAKUSEI | student", c: "script", ch: "kana", p: 1},
    {x: "がくせい | 学生 | gakusei | student", c: "script", ch: "kanji", p: 2},
  ]);
  const groups = searchGroups(index, state("gakusei"));
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].occurrences, index.entries);
  assert.equal(groups[0].entry, index.entries[0]);
  assert.equal(new Set(groups[0].occurrences.map((entry) => resultHref(entry, index.pages))).size, 3);
});

test("filtering happens before grouping, so hidden chapters and categories never supply source links", () => {
  const index = sample([
    {x: "がくせい | 学生 | gakusei | student"},
    {x: "がくせい | 学生 | gakusei | student", c: "script", ch: "kana", p: 1},
    {x: "がくせい | 学生 | gakusei | student", c: "script", ch: "kanji", p: 2},
  ]);
  assert.deepEqual(searchGroups(index, state("gakusei", "script"))[0].occurrences.map((entry) => entry.p), [1, 2]);
  assert.deepEqual(searchGroups(index, state("gakusei", "all", "kanji"))[0].occurrences.map((entry) => entry.p), [2]);
  assert.deepEqual(searchGroups(index, state("gakusei", "vocab", "kana")), []);
});

test("different meanings, readings, notes, table schemas and exercise/answer categories stay separate", () => {
  const index = sample([
    {x: "がくせい | 学生 | gakusei | student | noun"},
    {x: "がくせい | 学生 | gakusei | pupil | noun"},
    {x: "がくせい | 学生 | gakusei | student | different note"},
    {x: "ガクセイ | 学生 | gakusei | student | noun"},
    {x: "がくせい | 学生 | gakusei | student | noun", h: 1},
    {x: "gakusei", c: "practice", h: null},
    {x: "gakusei", c: "answers", h: null},
  ], [["Kana", "Kanji", "Romaji", "English", "Break"], ["Prompt", "Kanji", "Romaji", "English", "Break"]]);
  assert.equal(searchGroups(index, state("gakusei")).length, 7);
});

test("repeated prose groups within a category while distinct examples stay accessible", () => {
  const index = sample([
    {x: "watashi wa gakusei desu.", c: "grammar", h: null},
    {x: "watashi wa gakusei desu.", c: "grammar", h: null, a: "another-heading"},
    {x: "watashi mo gakusei desu.", c: "grammar", h: null},
    {x: "watashi wa gakusei desu.", c: "answers", h: null},
  ]);
  const groups = searchGroups(index, state("gakusei"));
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].occurrences.map((entry) => entry.id), [0, 1]);
});

test("normalization handles width, composed kana and whitespace, with literal punctuation and no guessed vowels", () => {
  assert.equal(normalizeSearchText(" ＧＡＫＵＳＥＩ  "), "gakusei");
  assert.equal(normalizeSearchText("か\u3099くせい"), "がくせい");
  assert.equal(normalizeSearchText("  two\n  words "), "two words");
  const index = sample([
    {x: "がっこう | 学校 | gakkou | school"},
    {x: "a+b", h: null, c: "grammar"},
    {x: "aaab", h: null, c: "grammar"},
  ]);
  assert.deepEqual(ids(searchGroups(index, state("a+b"))), [1]);
  assert.deepEqual(searchGroups(index, state("gakkō")), []);
  assert.equal(searchGroups(library, state("か\u3099くせい"))[0].entry.x, "がくせい | 学生 | gakusei | student");
});

test("real grouped searches retain exactly every matching source row once", () => {
  for (const q of ["gakusei", "gakkou", "学生", "student", "いちじかんはん", "ほんや ミナミ", "juuman en gurai"]) {
    const query = state(q);
    const matches = matchEntries(library.entries, query);
    const groups = searchGroups(library, query);
    const members = groups.flatMap((group) => group.occurrences);
    assert.equal(members.length, matches.length);
    assert.equal(new Set(members.map((entry) => entry.id)).size, matches.length);
    assert.deepEqual(members.map((entry) => entry.id).sort((a, b) => a - b), matches.map((entry) => entry.id).sort((a, b) => a - b));
  }
  assert.ok(searchGroups(library, state("gakusei")).length < matchEntries(library.entries, state("gakusei")).length);
});

test("chapter, kana, kanji and practice pages all participate with real source links", () => {
  for (const [q, prefix] of [["gakusei", "/chapters/"], ["gakusei", "/kana/"], ["いちじかんはん", "/kanji/2"], ["ほんや ミナミ", "/practice/1"]]) {
    const members = searchGroups(library, state(q)).flatMap((group) => group.occurrences);
    assert.ok(members.some((entry) => resultHref(entry, library.pages).startsWith(prefix)), q + " -> " + prefix);
  }
});

test("idle, no matches and filter-only browsing preserve existing behavior without mutating the index", () => {
  const before = JSON.stringify(library);
  assert.deepEqual(searchGroups(library, state("")), []);
  assert.deepEqual(searchGroups(library, state("   ")), []);
  assert.deepEqual(searchGroups(library, state("zzzz-no-match")), []);
  const browsing = searchGroups(library, state("", "vocab", "6"));
  assert.ok(browsing.length > 50);
  assert.deepEqual(ids(browsing), ids(browsing).toSorted((a, b) => a - b));
  for (const group of browsing) assert.ok(group.occurrences.every((entry) => entry.c === "vocab" && entry.ch === "6"));
  assert.deepEqual(searchGroups(library, state("gakusei")), searchGroups(library, state("gakusei")));
  assert.equal(JSON.stringify(library), before);
});
