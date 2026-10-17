// Tests for src/lib/toc.ts: outline grouping, nesting, order and anchors.
// Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anchorIds, countLinks, documentOutline, flattenIds, studyOutline } from "../src/lib/toc.ts";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const studyPages = [
  ...load("chapters.json").map((p) => ["chapter", p]),
  ...load("kana.json").map((p) => ["kana", p]),
  ...load("kanji.json").map((p) => ["kanji", p]),
];
const { docs, items } = load("lesson-data.json");

test("study outlines: five sections on top, every toc entry under the section that holds it", () => {
  assert.equal(studyPages.length, 12);
  for (const [group, page] of studyPages) {
    const name = `${group} ${page.ch}`;
    const outline = studyOutline(page.sections, page.toc);
    assert.deepEqual(outline.map((n) => n.id), page.sections.map((s) => s.id), name);
    assert.deepEqual(outline.map((n) => n.label), page.sections.map((s) => s.title), name);
    // nothing lost, nothing added, original order kept
    assert.deepEqual(outline.flatMap((n) => n.children.map((c) => c.id)), page.toc.map((e) => e.a), name);
    assert.deepEqual(outline.flatMap((n) => n.children.map((c) => c.label)), page.toc.map((e) => e.t), name);
    // each child's anchor really is in its section's HTML
    outline.forEach((node, i) => {
      const ids = new Set(anchorIds(page.sections[i].html));
      for (const child of node.children) assert.ok(ids.has(child.id), `${name}: ${child.id} not in ${node.id}`);
      for (const child of node.children) assert.equal(child.children.length, 0);
    });
    assert.equal(countLinks(outline), page.sections.length + page.toc.length, name);
  }
});

test("the 118-entry kana outline is grouped, not flat", () => {
  const kana = load("kana.json")[0];
  const outline = studyOutline(kana.sections, kana.toc);
  assert.equal(kana.toc.length, 118);
  assert.equal(outline.length, 5);
  assert.deepEqual(outline.map((n) => n.children.length), [31, 19, 32, 18, 18]);
  assert.ok(Math.max(...outline.map((n) => n.children.length)) < 118);
});

test("study outline edge cases", () => {
  const sections = [
    { id: "lessons", title: "Lessons", html: '<h3 id="a">A</h3><h3 id="shared">S</h3>' },
    { id: "vocab", title: "Vocabulary", html: '<h3 id="b">B</h3><h3 id="shared">S2</h3>' },
  ];
  const toc = [
    { a: "b", t: "B", l: 3 },
    { a: "a", t: "A", l: 3 },
    { a: "shared", t: "S", l: 3 },
    { a: "missing", t: "Missing", l: 3 },
  ];
  const outline = studyOutline(sections, toc);
  assert.deepEqual(outline.map((n) => n.id), ["lessons", "vocab", "missing"]); // unclaimed kept at the end
  assert.deepEqual(outline[0].children.map((c) => c.id), ["a", "shared"]);    // first section wins a repeated id
  assert.deepEqual(outline[1].children.map((c) => c.id), ["b"]);
  assert.deepEqual(studyOutline([], []), []);
});

test("document outlines keep toc order and nest level 3 under level 2", () => {
  assert.equal(docs.length, 20);
  for (const doc of docs) {
    const outline = documentOutline(doc.toc);
    assert.deepEqual(flattenIds(outline), doc.toc.map((e) => e.a), `doc ${doc.n}`);
    assert.equal(countLinks(outline), doc.toc.length);
    const level = new Map(doc.toc.map((e) => [e.a, e.l]));
    for (const node of outline) {
      assert.equal(level.get(node.id), 2, `doc ${doc.n}: top level should be level 2`);
      for (const child of node.children) assert.equal(level.get(child.id), 3);
    }
  }
  assert.deepEqual(documentOutline(docs.find((d) => d.n === 20).toc), []);
});

test("document outline edge cases", () => {
  const e = (a, l) => ({ a, t: a.toUpperCase(), l });
  const outline = documentOutline([e("intro", 3), e("one", 2), e("one-a", 3), e("one-b", 3), e("two", 2), e("two-a", 3), e("deep", 4), e("three", 2)]);
  assert.deepEqual(outline.map((n) => n.id), ["intro", "one", "two", "three"]); // a level 3 with no level 2 above stays on top
  assert.deepEqual(outline[1].children.map((n) => n.id), ["one-a", "one-b"]);
  assert.deepEqual(outline[2].children[0].children.map((n) => n.id), ["deep"]);
  assert.equal(outline[1].children[0].label, "ONE-A");
  assert.deepEqual(documentOutline([]), []);
});

test("anchors: every toc and search anchor exists in the page HTML", () => {
  for (const doc of docs) {
    const ids = new Set(anchorIds(doc.html));
    for (const entry of doc.toc) assert.ok(ids.has(entry.a), `doc ${doc.n}: ${entry.a}`);
  }
  const docIds = new Map(docs.map((doc) => [doc.n, new Set(anchorIds(doc.html))]));
  for (const item of items) if (item.a) assert.ok(docIds.get(item.d).has(item.a), `search anchor ${item.d}#${item.a}`);
  for (const [, page] of studyPages) {
    const ids = new Set([...page.sections.map((s) => s.id), ...page.sections.flatMap((s) => anchorIds(s.html))]);
    for (const entry of page.toc) assert.ok(ids.has(entry.a));
    assert.equal(ids.size, page.sections.length + page.sections.flatMap((s) => anchorIds(s.html)).length, "no repeated ids");
  }
});

test("anchorIds reads id attributes only", () => {
  assert.deepEqual(anchorIds(`<h2 id="x">X</h2><p data-id="no">n</p><h3 id='y'>Y</h3><div class="id=no"></div>`), ["x", "y"]);
});
