// Tests for src/lib/documents.ts: the content tags in the document library.
// Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORY_ORDER, chapterSummary, documentCategories, documentSummaries } from "../src/lib/documents.ts";

const data = JSON.parse(readFileSync(new URL("../src/data/lesson-data.json", import.meta.url), "utf8"));

test("categories come from the entries, deduplicated and in a fixed order", () => {
  const items = [
    { d: 1, c: "practice" },
    { d: 1, c: "vocab" },
    { d: 2, c: "answers" },
    { d: 1, c: "grammar" },
    { d: 1, c: "vocab" },
    { d: 1, c: "practice" },
  ];
  const result = documentCategories(items);
  assert.deepEqual(result.get(1), ["grammar", "vocab", "practice"]);
  assert.deepEqual(result.get(2), ["answers"]);
  assert.equal(result.has(3), false);
});

test("the order covers every category the data uses", () => {
  const used = new Set(data.items.map((item) => item.c));
  assert.deepEqual([...used].filter((c) => !CATEGORY_ORDER.includes(c)), []);
  assert.equal(new Set(CATEGORY_ORDER).size, CATEGORY_ORDER.length);
});

test("matches entries by item.d to doc.n, not by position or title", () => {
  const docs = [
    { n: 7, title: "Vocabulary list", kind: "Vocabulary", date: "", chapters: [], toc: [], html: "", link: "", intro: "" },
    { n: 3, title: "Grammar notes", kind: "Reviewer", date: "", chapters: [], toc: [], html: "", link: "", intro: "" },
  ];
  const items = [{ d: 3, c: "vocab" }, { d: 7, c: "answers" }];
  const [first, second] = documentSummaries({ docs, items });
  // The title says "Vocabulary" and kind is "Vocabulary", but its only entries are answers
  assert.deepEqual(first.categories, ["answers"]);
  assert.deepEqual(second.categories, ["vocab"]);
});

test("a document with no entries gets no tags", () => {
  const docs = [{ n: 1, title: "Empty", kind: "Extra", date: "", chapters: [], toc: [], html: "", link: "", intro: "" }];
  assert.deepEqual(documentSummaries({ docs, items: [] })[0].categories, []);
});

test("real data: the first reviewer has Grammar, Vocabulary and Practice", () => {
  const first = documentSummaries(data).find((doc) => doc.n === 1);
  assert.deepEqual(first.categories, ["grammar", "vocab", "practice"]);
  assert.equal(first.kind, "Reviewer"); // the source type stays separate
});

test("real data: every document's tags match its own entries exactly", () => {
  const summaries = documentSummaries(data);
  assert.equal(summaries.length, data.docs.length);
  for (const doc of summaries) {
    const own = new Set(data.items.filter((item) => item.d === doc.n).map((item) => item.c));
    assert.deepEqual(new Set(doc.categories), own, `document ${doc.n}`);
    assert.deepEqual(doc.categories, CATEGORY_ORDER.filter((c) => own.has(c)), `document ${doc.n} order`);
  }
});

test("summaries carry only what a library row needs", () => {
  for (const doc of documentSummaries(data)) {
    assert.deepEqual(Object.keys(doc).sort(), ["categories", "chapters", "date", "kind", "n", "title"]);
  }
});

test("chapter summaries", () => {
  assert.equal(chapterSummary(["1", "2", "3", "4", "5"]), "Chapters 1 to 5");
  assert.equal(chapterSummary(["6"]), "Chapter 6");
  assert.equal(chapterSummary(["3", "5"]), "Chapters 3, 5");
  assert.equal(chapterSummary(["kana"]), "Kana");
  assert.equal(chapterSummary(["kanji"]), "Kanji");
  assert.equal(chapterSummary([]), "");
});
