// Tests for the move from the old documents to the study pages: every old
// section has a decision, added content is still on its page, the new pages
// are complete, and old links land on real places. Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { anchorIds, studyOutline } from "../src/lib/toc.ts";
import { plainText } from "../src/lib/search.ts";
import { legacyTarget } from "../src/lib/study.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const load = (name) => JSON.parse(read(`src/data/${name}`));
const audit = JSON.parse(read("migration/document-audit.json"));
const links = load("legacy-links.json");

const groups = { chapter: "/chapters", kana: "/kana", kanji: "/kanji", practice: "/practice" };
const files = { chapter: "chapters.json", kana: "kana.json", kanji: "kanji.json", practice: "practice.json" };
const pages = new Map();
for (const [kind, base] of Object.entries(groups)) {
  for (const page of load(files[kind])) {
    const html = page.sections.map((s) => s.html).join("\n");
    pages.set(`${base}/${page.ch}`, {
      kind,
      page,
      ids: new Set([...page.sections.map((s) => s.id), ...anchorIds(html)]),
      // every id in page order, each section id before the ids inside it
      order: page.sections.flatMap((s) => [s.id, ...anchorIds(s.html)]),
      outline: studyOutline(page.sections, page.toc),
      text: plainText(`${page.intro ?? ""} ${html.replace(/<\/(td|th|p|li|h\d)>/g, " $&")}`),
    });
  }
}
const page = (href) => pages.get(href);
const section = (href, id) => page(href).page.sections.find((s) => s.id === id);

// Real place: the page exists, and the anchor (if any) is an id on it
function assertLands(href, where) {
  const [path, anchor] = href.split("#");
  assert.ok(page(path), `${where}: no page ${path}`);
  if (anchor) assert.ok(page(path).ids.has(anchor), `${where}: ${path} has no #${anchor}`);
}

// ---- The audit ----

const DECISIONS = new Set(["merged", "covered", "moved", "dropped"]);

test("all 20 documents are audited, and every section has a decision and a destination", () => {
  assert.deepEqual(audit.docs.map((d) => d.n), Array.from({ length: 20 }, (_, i) => i + 1));
  let sections = 0;
  for (const doc of audit.docs) {
    assert.ok(doc.title, `doc ${doc.n}`);
    assertLands(doc.to, `doc ${doc.n}`);
    assert.ok(doc.sections.length > 0, `doc ${doc.n} has no sections`);
    for (const s of doc.sections) {
      const where = `doc ${doc.n} ${s.a || "(intro)"}`;
      assert.ok(DECISIONS.has(s.decision), `${where}: ${s.decision}`);
      assert.ok(s.note && s.note.trim(), `${where}: no note`);
      assert.ok(!/Added [.;]|\?\./.test(s.note), `${where}: ${s.note}`);
      assertLands(s.to, where);
      // only merged sections add lines, and every merge says what it added
      assert.equal(Boolean(s.checks?.length), s.decision === "merged", where);
      sections++;
    }
  }
  assert.equal(sections, 503);
});

test("the documents went where the plan says", () => {
  const to = Object.fromEntries(audit.docs.map((d) => [d.n, d.to.split("#")[0]]));
  for (const n of [1, 2, 6, 7, 9, 11, 14, 16]) assert.match(to[n], /^\/chapters\/\d+$/, `doc ${n}`);
  assert.equal(to[4], "/kana/1");
  assert.equal(to[12], "/kanji/1");
  assert.equal(to[13], "/kanji/1");
  assert.deepEqual([to[5], to[8], to[10], to[15], to[17]], ["/chapters/6", "/chapters/7", "/chapters/8", "/chapters/9", "/chapters/10"]);
  assert.equal(to[18], "/kanji/2");
  assert.equal(to[19], "/kanji/2");
  assert.equal(to[3], "/practice/1");
  assert.equal(to[20], "/chapters/3");
});

// Lines the audit records as added, written the way the page source writes them
function plainCheck(line) {
  return plainText(
    line
      .replace(/^#+\s+/, "")
      .replace(/^[-*]\s+/, "")
      .replace(/\*\*|`/g, "")
      .replace(/\\([_*[\]()|])/g, "$1")
  );
}

test("every line that was merged in is still on its page", () => {
  let checked = 0;
  for (const doc of audit.docs) {
    for (const s of doc.sections) {
      for (const check of s.checks ?? []) {
        const [kind, ch] = check.page.split(":");
        const target = page(`${groups[kind]}/${ch}`);
        assert.ok(target, check.page);
        const cells = check.text.startsWith("|") ? check.text.split("|").map(plainCheck).filter(Boolean) : [plainCheck(check.text)];
        for (const cell of cells) assert.ok(target.text.includes(cell), `doc ${doc.n} ${s.a}: "${cell}" is not on ${check.page}`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 170, `${checked} checks`);
});

// ---- The new pages ----

// Rows of every table under each h3 of a section, by heading text
function rowsByHeading(html) {
  const out = new Map();
  for (const part of html.split(/(?=<h3 id=)/)) {
    const head = part.match(/^<h3 id="[^"]+">([\s\S]*?)<\/h3>/);
    if (head) out.set(plainText(head[1]), (part.match(/<tbody>[\s\S]*?<\/tbody>/g) ?? []).join("").split("<tr>").length - 1);
  }
  return out;
}

test("Kanji 2 is complete: 30 kanji, the word lists, the mix-ups and every exercise with an answer", () => {
  const kanji2 = page("/kanji/2");
  assert.equal(kanji2.page.title, "Time, Seasons and Directions");
  assert.deepEqual(kanji2.page.sections.map((s) => s.id), ["lessons", "vocab", "mixups", "exercises", "answers"]);
  const lessons = section("/kanji/2", "lessons").html;
  const kanji = [...lessons.matchAll(/<h3 id="[^"]+">(.) \(/g)].map((m) => m[1]);
  assert.equal(kanji.length, 30);
  assert.equal(new Set(kanji).size, 30);
  for (const k of ["半", "午", "今", "春", "東", "上", "前", "後"]) assert.ok(kanji.includes(k), k);
  // workbook parts A to D (30 items each) and the self-test parts E to J
  const expected = { A: 30, B: 30, C: 30, D: 30, E: 15, F: 15, G: 10, H: 8, I: 8, J: 8 };
  const ex = [...rowsByHeading(section("/kanji/2", "exercises").html)];
  const ans = [...rowsByHeading(section("/kanji/2", "answers").html)];
  for (const [letter, n] of Object.entries(expected)) {
    const q = ex.find(([t]) => t.startsWith(`Part ${letter}:`));
    const a = ans.find(([t]) => t.startsWith(`Part ${letter}:`));
    assert.ok(q && a, `Part ${letter}`);
    assert.equal(q[1], n, `Part ${letter} questions`);
    assert.equal(a[1], n, `Part ${letter} answers`);
  }
  assert.ok(kanji2.text.includes("seasons") || kanji2.text.includes("Seasons"));
  assertLands("/kanji/2#c2-seasons", "seasons");
});

test("the workbook answers are model answers, never called the official key", () => {
  for (const href of ["/kanji/1", "/kanji/2"]) {
    const answers = plainText(section(href, "answers").html);
    assert.match(answers, /They are model answers, not the official answer key\./, href);
    assert.ok(!/\bofficial answers?\b(?! key)/i.test(answers.replace("not the official answer key", "")), href);
  }
});

test("the N5 practice page has both exams with every question, answer and explanation", () => {
  const practice = page("/practice/1");
  assert.deepEqual(practice.page.sections.map((s) => s.id), ["exercises", "answers"]);
  const ex = [...rowsByHeading(section("/practice/1", "exercises").html)];
  const ans = [...rowsByHeading(section("/practice/1", "answers").html)];
  const exam1 = ex.filter(([t]) => t.startsWith("Exam 1, Chapter"));
  const exam2 = ex.filter(([t]) => t.startsWith("Exam 2, Passage"));
  assert.equal(exam1.length, 5);
  assert.equal(exam2.length, 3);
  assert.equal(exam1.reduce((n, [, rows]) => n + rows, 0), 40);
  assert.equal(exam2.reduce((n, [, rows]) => n + rows, 0), 14);
  // the answer key has the same parts and as many rows
  assert.deepEqual(ans.filter(([t]) => t.startsWith("Exam")), [...exam1, ...exam2]);
  assert.ok(ans.some(([t]) => t === "English translations of the passages"));
  // every answer row has a choice and a reason
  const rows = section("/practice/1", "answers").html.match(/<tr><td>\d+<\/td><td>[^<]+<\/td><td>[^<]+<\/td><\/tr>/g);
  assert.equal(rows.length, 54);
  // every question offers choices
  const questions = section("/practice/1", "exercises").html.match(/<tr><td>\d+<\/td><td>[^<]*\(a\)[^<]*\(b\)/g);
  assert.equal(questions.length, 54);
});

test("the Kim and Ben dialogue is Chapter 3 supplemental reading", () => {
  assertLands("/chapters/3#c3-3-10-supplemental-reading-kim-and-ben", "dialogue");
  const ch3 = page("/chapters/3");
  assert.ok(ch3.outline.some((n) => n.children.some((c) => c.id === "c3-3-10-supplemental-reading-kim-and-ben")));
  assert.ok(ch3.text.includes("juuman en gurai"));
});

// ---- Old links ----

test("every old link has a destination, and every old anchor is mapped", () => {
  assert.deepEqual(Object.keys(links), audit.docs.map((d) => String(d.n)));
  for (const doc of audit.docs) {
    const map = links[String(doc.n)];
    assert.equal(map.to[0], doc.to, `doc ${doc.n}`);
    assertLands(map.to[0], `doc ${doc.n}`);
    const oldAnchors = doc.sections.map((s) => s.a).filter(Boolean);
    assert.deepEqual(Object.keys(map.anchors).sort(), [...oldAnchors].sort(), `doc ${doc.n}`);
    for (const [old, target] of Object.entries(map.anchors)) {
      assertLands(target[0], `${doc.n}#${old}`);
      assert.equal(target[0], doc.sections.find((s) => s.a === old).to, `${doc.n}#${old}`);
    }
  }
});

test("a saved place lands on an outline entry with that entry's own label", () => {
  for (const [n, map] of Object.entries(links)) {
    for (const [old, [href, mark, label]] of [["(page)", map.to], ...Object.entries(map.anchors)]) {
      const where = `${n}#${old}`;
      if (mark === null) {
        assert.equal(label, null, where);
        assert.ok(!href.includes("#"), where);
        continue;
      }
      const [path, anchor] = href.split("#");
      const { outline, order } = page(path);
      const entries = outline.flatMap((s) => [s, ...s.children]);
      const entry = entries.find((e) => e.id === mark);
      assert.ok(entry, `${where}: #${mark} is not in the outline`);
      assert.equal(label, entry.label, where);
      // A link to a smaller heading is saved under the outline entry that holds it:
      // the last outline entry at or before it on the page
      const at = order.indexOf(anchor);
      const holder = entries.filter((e) => order.indexOf(e.id) <= at).sort((a, b) => order.indexOf(b.id) - order.indexOf(a.id))[0];
      assert.equal(holder.id, mark, `${where}: #${anchor} is not under #${mark}`);
    }
  }
});

test("legacy lookups: known anchors, unknown anchors and unknown documents", () => {
  assert.deepEqual(legacyTarget(links, "18", "d18-cheat-sheet-seasons"), ["/kanji/2#c2-seasons", "c2-seasons", "Seasons"]);
  assert.deepEqual(legacyTarget(links, "12", "no-such-anchor"), links["12"].to);
  assert.deepEqual(legacyTarget(links, "3", null), ["/practice/1", null, null]);
  assert.equal(legacyTarget(links, "21", null), null);
  assert.equal(legacyTarget(links, "constructor", null), null);
  assert.equal(legacyTarget(links, "__proto__", null), null);
});

// ---- Nothing left of the old feature ----

function sourceFiles(dir) {
  return readdirSync(new URL(dir, root)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(new URL(path, root)).isDirectory() ? sourceFiles(path) : [path];
  });
}

test("no page, component or helper depends on the old documents", () => {
  const sources = sourceFiles("src").filter((f) => /\.(tsx?|css|json)$/.test(f));
  for (const gone of ["src/data/lesson-data.json", "src/lib/documents.ts", "src/components/DocumentLibrary.tsx", "src/components/DocumentCard.tsx"]) {
    assert.ok(!sources.includes(gone), `${gone} should be deleted`);
  }
  for (const file of sources.filter((f) => !f.endsWith(".json"))) {
    const text = read(file);
    for (const word of ["lesson-data", "DocumentLibrary", "DocumentCard", "lib/documents", "documentOutline"]) {
      assert.ok(!text.includes(word), `${file} mentions ${word}`);
    }
  }
  // the only route left under /lessons is the small compatibility page
  assert.deepEqual(sourceFiles("src/app/lessons"), ["src/app/lessons/[n]/page.tsx"]);
  assert.ok(!read("src/app/lessons/[n]/page.tsx").includes("dangerouslySetInnerHTML"));
});

test("the study pages carry no long dashes or authoring notes", () => {
  for (const name of Object.values(files)) {
    const text = read(`src/data/${name}`);
    assert.ok(!/[–—]/.test(text), `${name} has a long dash`);
    for (const pattern of [/\bdocuments?\b/i, /\bDoc \d/, /\breviewer\b/i, /lesson-data/, /\bgenerated\b/i]) {
      assert.ok(!pattern.test(text), `${name} matches ${pattern}`);
    }
  }
});
