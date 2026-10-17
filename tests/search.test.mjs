// Regression tests for src/lib/search.ts, using Node's built-in test runner.
// Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORIES,
  DEFAULT_STATE,
  buildChapterOptions,
  buildSearchPayload,
  chapterLabel,
  isDefaultState,
  lessonHref,
  matchEntries,
  parseSearchState,
  searchUrl,
} from "../src/lib/search.ts";

const data = JSON.parse(readFileSync(new URL("../src/data/lesson-data.json", import.meta.url), "utf8"));
const payload = buildSearchPayload(data);
const chapterValues = new Set(payload.chapters.map((o) => o.value));
const parse = (query) => parseSearchState(new URLSearchParams(query), chapterValues);

// The filter from the old Search.tsx, copied as it was, to compare against
function originalFilter(items, query, category, chapter) {
  const q = query.trim().toLowerCase();
  if (!q && category === "all" && chapter === "all") return [];
  return items.filter(
    (item) =>
      (category === "all" || item.c === category) &&
      (chapter === "all" || item.ch === chapter) &&
      item.x.toLowerCase().includes(q)
  );
}

test("matching gives the same entries in the same order as before", () => {
  const queries = ["", "  GAKKOU ", "gakkou", "がっこう", "desu", "Desu", "ka", "の", "学校", "a | b", "zzzz-no-match"];
  const categories = CATEGORIES.map((c) => c.value);
  const chapters = ["all", ...chapterValues];
  let checked = 0;
  for (const q of queries) {
    for (const category of categories) {
      for (const chapter of chapters) {
        const before = originalFilter(data.items, q, category, chapter).map((item) => data.items.indexOf(item));
        const after = matchEntries(payload.entries, { q, category, chapter }).map((entry) => entry.id);
        assert.deepEqual(after, before, `q=${JSON.stringify(q)} category=${category} chapter=${chapter}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 800);
});

test("known counts still hold", () => {
  const count = (q, category = "all", chapter = "all") => matchEntries(payload.entries, { q, category, chapter }).length;
  assert.equal(count("  GAKKOU "), 10);
  assert.equal(count("", "vocab", "6"), 176);
  assert.equal(count("", "all", "6"), 332);
  assert.equal(count(""), 0); // idle: nothing until there is text or a filter
  assert.equal(count("   "), 0);
});

test("payload keeps only what search needs", () => {
  assert.equal(payload.entries.length, data.items.length);
  assert.deepEqual(Object.keys(payload).sort(), ["chapters", "docs", "entries", "headers"]);
  for (const doc of payload.docs) assert.deepEqual(Object.keys(doc).sort(), ["n", "title"]);
  payload.entries.forEach((entry, i) => {
    assert.deepEqual(Object.keys(entry).sort(), ["a", "b", "c", "ch", "d", "h", "id", "x"]);
    assert.equal(entry.id, i);
    const item = data.items[i];
    for (const key of ["d", "a", "ch", "c", "b", "x"]) assert.equal(entry[key], item[key]);
    if (item.t === "r") assert.deepEqual(payload.headers[entry.h], item.hd);
    else assert.equal(entry.h, null);
  });
  const text = JSON.stringify(payload);
  for (const field of ['"html"', '"toc"', '"intro"', '"link"', '"cells"', '"hd"']) {
    assert.ok(!text.includes(field), `payload should not contain ${field}`);
  }
  // each header list is stored once
  assert.equal(new Set(payload.headers.map((h) => JSON.stringify(h))).size, payload.headers.length);
});

test("chapter options come from the data, numbers first", () => {
  assert.deepEqual(
    payload.chapters.map((o) => o.value),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "gen", "kana", "kanji"]
  );
  assert.deepEqual(payload.chapters.at(-3), { value: "gen", label: "General" });
  assert.deepEqual(buildChapterOptions(["10", "2", "zeta", "kanji", "2", "1", "alpha"]).map((o) => o.value), [
    "1", "2", "10", "kanji", "alpha", "zeta",
  ]);
  assert.equal(chapterLabel("7"), "Chapter 7");
  assert.equal(chapterLabel("kana"), "Kana");
});

test("reading the URL", () => {
  assert.deepEqual(parse(""), DEFAULT_STATE);
  assert.deepEqual(parse("q=gakkou&category=vocab&chapter=6"), { q: "gakkou", category: "vocab", chapter: "6" });
  assert.deepEqual(parse("chapter=kana"), { q: "", category: "all", chapter: "kana" });
  // invalid values fall back to the defaults
  assert.deepEqual(parse("category=nope&chapter=99"), DEFAULT_STATE);
  assert.deepEqual(parse("category=Vocab&chapter=all"), DEFAULT_STATE);
  assert.deepEqual(parse("category=&chapter="), DEFAULT_STATE);
  // the first value wins when a param repeats
  assert.equal(parse("q=a&q=b").q, "a");
  assert.equal(parse("q=%E3%81%8C%E3%81%A3%E3%81%93%E3%81%86").q, "がっこう");
});

test("writing the URL omits defaults and keeps everything else", () => {
  const loc = (search = "", hash = "") => ({ pathname: "/", search, hash });
  assert.equal(searchUrl(loc(), DEFAULT_STATE), "/");
  assert.equal(searchUrl(loc("?q=old&category=vocab"), DEFAULT_STATE), "/");
  assert.equal(searchUrl(loc(), { q: "  gakkou ", category: "all", chapter: "all" }), "/?q=gakkou");
  assert.equal(searchUrl(loc(), { q: "   ", category: "grammar", chapter: "all" }), "/?category=grammar");
  assert.equal(
    searchUrl(loc("?utm=x&q=old", "#search"), { q: "desu", category: "vocab", chapter: "6" }),
    "/?utm=x&q=desu&category=vocab&chapter=6#search"
  );
  assert.equal(searchUrl(loc("?chapter=99&utm=x"), DEFAULT_STATE), "/?utm=x");
  assert.equal(searchUrl(loc(), { q: "がっこう", category: "all", chapter: "all" }), "/?q=%E3%81%8C%E3%81%A3%E3%81%93%E3%81%86");
});

test("URL round trip", () => {
  const loc = { pathname: "/", search: "", hash: "" };
  const states = [
    DEFAULT_STATE,
    { q: "gakkou", category: "all", chapter: "all" },
    { q: "がっこう です", category: "script", chapter: "kanji" },
    { q: "a&b=c?#", category: "answers", chapter: "10" },
  ];
  for (const state of states) {
    const url = new URL(searchUrl(loc, state), "http://x");
    assert.deepEqual(parseSearchState(url.searchParams, chapterValues), state);
  }
});

test("idle state and lesson links", () => {
  assert.equal(isDefaultState(DEFAULT_STATE), true);
  assert.equal(isDefaultState({ q: "  ", category: "all", chapter: "all" }), true);
  assert.equal(isDefaultState({ q: "", category: "all", chapter: "3" }), false);
  assert.equal(lessonHref({ d: 4, a: "d4-places" }), "/lessons/4#d4-places");
  assert.equal(lessonHref({ d: 4, a: "" }), "/lessons/4");
  // every entry links to the same place as before
  payload.entries.forEach((entry, i) => {
    const item = data.items[i];
    assert.equal(lessonHref(entry), `/lessons/${item.d}${item.a ? `#${item.a}` : ""}`);
  });
});
