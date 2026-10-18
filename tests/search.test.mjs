// Regression tests for src/lib/search.ts, using Node's built-in test runner.
// Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATEGORIES,
  DEFAULT_STATE,
  buildChapterOptions,
  buildSearchIndex,
  categoryFor,
  chapterLabel,
  isDefaultState,
  matchEntries,
  parseSearchState,
  plainText,
  resultHref,
  searchUrl,
} from "../src/lib/search.ts";
import { anchorIds } from "../src/lib/toc.ts";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
// The same groups, in the same order, as src/lib/library.ts
const sources = [
  { kind: "chapter", label: "Chapter", basePath: "/chapters", pages: load("chapters.json") },
  { kind: "kana", label: "Kana", basePath: "/kana", pages: load("kana.json") },
  { kind: "kanji", label: "Kanji", basePath: "/kanji", pages: load("kanji.json") },
  { kind: "practice", label: "Practice", basePath: "/practice", pages: load("practice.json") },
];
const index = buildSearchIndex(sources);
const chapters = buildChapterOptions(index.entries.map((e) => e.ch));
const chapterValues = new Set(chapters.map((o) => o.value));
const parse = (query) => parseSearchState(new URLSearchParams(query), chapterValues);
const search = (q, category = "all", chapter = "all") => matchEntries(index.entries, { q, category, chapter });
const hrefs = (results) => results.map((e) => resultHref(e, index.pages));

// Every page, with the ids its HTML really has
const pagesByHref = new Map(
  sources.flatMap((s) =>
    s.pages.map((p) => [`${s.basePath}/${p.ch}`, { source: s, page: p, ids: new Set([...p.sections.map((x) => x.id), ...p.sections.flatMap((x) => anchorIds(x.html))]) }])
  )
);

test("the index covers every study page and nothing else", () => {
  assert.deepEqual(index.pages.map((p) => p.href), [...pagesByHref.keys()]);
  assert.equal(index.pages.length, 14);
  assert.equal(index.pages.find((p) => p.href === "/kanji/2").name, "Kanji 2: Time, Seasons and Directions");
  assert.equal(index.pages.find((p) => p.href === "/practice/1").name, "Practice 1: N5 Practice Exam, Chapters 1 to 5");
  // every page has entries
  for (let p = 0; p < index.pages.length; p++) assert.ok(index.entries.some((e) => e.p === p), index.pages[p].href);
});

test("every result has a real page, a real anchor, and the right chapter, category and breadcrumb", () => {
  index.entries.forEach((entry, i) => {
    assert.equal(entry.id, i);
    assert.deepEqual(Object.keys(entry).sort(), ["a", "b", "c", "ch", "h", "id", "p", "x"]);
    const href = resultHref(entry, index.pages);
    const [path, anchor] = href.split("#");
    const target = pagesByHref.get(path);
    assert.ok(target, href);
    assert.ok(anchor && target.ids.has(anchor), `${href}: no such id on the page`);
    assert.equal(entry.ch, target.source.kind === "chapter" ? target.page.ch : target.source.kind);
    // the anchor is in the section the breadcrumb starts with, and that section sets the category
    const section = target.page.sections.find((s) => entry.b === s.title || entry.b.startsWith(`${s.title} › `));
    assert.ok(section, `${href}: breadcrumb ${entry.b}`);
    assert.ok(anchor === section.id || anchorIds(section.html).includes(anchor), `${href} is not in ${section.id}`);
    assert.equal(entry.c, categoryFor(target.source.kind, section.id));
    assert.ok(entry.x.trim(), `${href}: empty text`);
    assert.ok(!/[<>]|&(amp|lt|gt);/.test(entry.x), `${href}: markup left in ${entry.x}`);
    if (entry.h !== null) assert.equal(entry.x.split(" | ").length, index.headers[entry.h].length, `${href}: ${entry.x}`);
  });
});

test("no duplicate results, and each header list is stored once", () => {
  const seen = new Set();
  for (const entry of index.entries) {
    const key = `${resultHref(entry, index.pages)}\n${entry.x}`;
    assert.ok(!seen.has(key), `duplicate: ${key}`);
    seen.add(key);
  }
  assert.equal(new Set(index.headers.map((h) => JSON.stringify(h))).size, index.headers.length);
  const text = JSON.stringify(index);
  for (const field of ['"html"', '"toc"', '"intro"', '"sections"', "<td>", "<p>"]) assert.ok(!text.includes(field), `index should not contain ${field}`);
});

test("the merged content is searchable where it now lives", () => {
  // Kanji 2, both exams, the Kim and Ben dialogue, and a few merged extras
  const where = (q, category = "all") => new Set(hrefs(search(q, category)).map((h) => h.split("#")[0]));
  assert.ok(where("半分").has("/kanji/2"));
  assert.ok(hrefs(search("いちじかんはん")).some((h) => h.startsWith("/kanji/2#c2-")));
  assert.ok(hrefs(search("douzo", "all", "practice")).includes("/practice/1#p1-exam-1-chapter-1-copula-sentences"));
  assert.ok(hrefs(search("ほんや ミナミ")).includes("/practice/1#p1-exam-2-passage-2-a-shop-sign"));
  assert.ok(hrefs(search("Next week's Friday is a day off")).includes("/practice/1#p1-english-translations-of-the-passages"));
  assert.ok(hrefs(search("juuman en gurai")).includes("/chapters/3#c3-3-10-supplemental-reading-kim-and-ben"));
  assert.ok(hrefs(search("tsumaranai", "practice")).some((h) => h.startsWith("/chapters/6#")));
  assert.ok(hrefs(search("From weakest to strongest")).includes("/chapters/7#c7-how-strong-is-it"));
  assert.ok(where("model answers").has("/kanji/1") && where("model answers").has("/kanji/2"));
});

test("matching: case-insensitive contains, filters, nothing while idle", () => {
  const gakkou = search("  GAKKOU ");
  assert.ok(gakkou.length > 10);
  for (const e of gakkou) assert.ok(e.x.toLowerCase().includes("gakkou"));
  assert.deepEqual(search("gakkou"), gakkou);
  // results stay in page order
  assert.deepEqual(gakkou.map((e) => e.id), [...gakkou.map((e) => e.id)].sort((a, b) => a - b));
  const vocab6 = search("", "vocab", "6");
  assert.ok(vocab6.length > 50);
  for (const e of vocab6) assert.ok(e.c === "vocab" && e.ch === "6");
  assert.ok(search("", "all", "6").length > vocab6.length);
  assert.ok(search("", "script", "kanji").every((e) => index.pages[e.p].href.startsWith("/kanji/")));
  assert.ok(search("", "all", "practice").every((e) => e.c === "practice" || e.c === "answers"));
  assert.equal(search("").length, 0); // idle: nothing until there is text or a filter
  assert.equal(search("   ").length, 0);
  assert.equal(search("zzzz-no-match").length, 0);
});

test("categories follow the page section", () => {
  assert.equal(categoryFor("chapter", "vocab"), "vocab");
  assert.equal(categoryFor("chapter", "lessons"), "grammar");
  assert.equal(categoryFor("chapter", "mixups"), "grammar");
  assert.equal(categoryFor("kanji", "lessons"), "script");
  assert.equal(categoryFor("kana", "vocab"), "script");
  for (const kind of ["chapter", "kana", "kanji", "practice"]) {
    assert.equal(categoryFor(kind, "exercises"), "practice");
    assert.equal(categoryFor(kind, "answers"), "answers");
  }
  // every category has results
  for (const { value } of CATEGORIES) if (value !== "all") assert.ok(search("", value).length > 0, value);
});

test("plain text from the page HTML", () => {
  assert.equal(plainText("<strong>wa</strong> &amp; <em>ga</em>"), "wa & ga");
  assert.equal(plainText("a &lt;b&gt; &#12354; &#x3042; &unknown;"), "a <b> あ あ &unknown;");
  assert.equal(plainText("  two\n  lines  "), "two lines");
});

test("chapter options come from the data, numbers first", () => {
  assert.deepEqual(chapters.map((o) => o.value), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "kana", "kanji", "practice"]);
  assert.deepEqual(chapters.at(-1), { value: "practice", label: "N5 practice" });
  assert.deepEqual(buildChapterOptions(["10", "2", "zeta", "kanji", "practice", "2", "1", "alpha", "kana"]).map((o) => o.value), [
    "1", "2", "10", "kana", "kanji", "practice", "alpha", "zeta",
  ]);
  assert.equal(chapterLabel("7"), "Chapter 7");
  assert.equal(chapterLabel("kana"), "Kana");
  assert.equal(chapterLabel("kanji"), "Kanji");
});

test("reading the URL", () => {
  assert.deepEqual(parse(""), DEFAULT_STATE);
  assert.deepEqual(parse("q=gakkou&category=vocab&chapter=6"), { q: "gakkou", category: "vocab", chapter: "6" });
  assert.deepEqual(parse("chapter=kana"), { q: "", category: "all", chapter: "kana" });
  assert.deepEqual(parse("chapter=practice"), { q: "", category: "all", chapter: "practice" });
  // invalid values fall back to the defaults, including the old General group
  assert.deepEqual(parse("category=nope&chapter=99"), DEFAULT_STATE);
  assert.deepEqual(parse("chapter=gen"), DEFAULT_STATE);
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
    { q: "douzo", category: "practice", chapter: "practice" },
  ];
  for (const state of states) {
    const url = new URL(searchUrl(loc, state), "http://x");
    assert.deepEqual(parseSearchState(url.searchParams, chapterValues), state);
  }
});

test("idle state and result links", () => {
  assert.equal(isDefaultState(DEFAULT_STATE), true);
  assert.equal(isDefaultState({ q: "  ", category: "all", chapter: "all" }), true);
  assert.equal(isDefaultState({ q: "", category: "all", chapter: "3" }), false);
  const pages = [{ href: "/chapters/4", name: "Chapter 4: Time" }];
  assert.equal(resultHref({ p: 0, a: "c4-days-of-the-week" }, pages), "/chapters/4#c4-days-of-the-week");
  assert.equal(resultHref({ p: 0, a: "vocab" }, pages), "/chapters/4#vocab");
});
