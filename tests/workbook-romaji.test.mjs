import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchIndex, searchGroups, plainText } from "../src/lib/search.ts";
import { anchorIds } from "../src/lib/toc.ts";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pages = JSON.parse(read("src/data/chapters.json"));
const audit = JSON.parse(read("migration/workbook-romaji-audit.json"));
const oldReadings = JSON.parse(read("migration/reading-exercise-audit.json"));
const chapterHtml = chapter => pages.find(page => page.ch === chapter).sections.find(section => section.id === "exercises").html;
function block(activity) {
  const html = chapterHtml(activity.chapter);
  const start = html.indexOf('<section class="workbook-activity" data-workbook-activity="' + activity.heading + '"');
  assert.ok(start >= 0, activity.heading);
  return html.slice(start, html.indexOf("</section>", start) + "</section>".length);
}
const visible = activity => block(activity).replace(/<details[\s\S]*?<\/details>/g, "");
const rows = html => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map(match => [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => cell[1])).filter(row => row.length);
const support = activity => block(activity).match(/<details[^>]*>([\s\S]*?)<\/details>/)?.[1] ?? "";

test("workbook coverage: original Chapters 1-10, all 78 updated activities and all 610 existing rows survive", () => {
  assert.equal(audit.version, 1);
  assert.deepEqual([...new Set(audit.activities.map(a => a.chapter))], pages.filter(page => Number(page.ch) <= 10).map(page => page.ch));
  assert.equal(audit.activities.length, 78);
  assert.equal(audit.activities.filter(a => a.hasSupport).length, 68);
  assert.equal(audit.activities.reduce((sum, a) => sum + a.questions.length, 0), 510);
  assert.equal(audit.activities.reduce((sum, a) => sum + a.rowCount, 0), 610);
  for (const a of audit.activities) {
    assert.equal(rows(block(a)).length, rows(a.originalHtml).length, a.heading);
    assert.equal(anchorIds(block(a)).filter(id => id === a.heading).length, 1);
    assert.match(visible(a), /<table><thead><tr><th>#<\/th><th>Question<\/th><th>Your answer<\/th>/);
  }
});

test("workbook reveals: one native closed disclosure per supported activity and no hidden question table", () => {
  for (const a of audit.activities) {
    const html = block(a);
    const details = [...html.matchAll(/<details([^>]*)>([\s\S]*?)<\/details>/g)];
    assert.equal(details.length, a.hasSupport ? 1 : 0);
    if (!a.hasSupport) continue;
    assert.ok(!/\bopen(?:\s|=|$)/.test(details[0][1]));
    assert.match(details[0][2], /<summary>Romaji support \(optional\)<\/summary>/);
    assert.ok(!details[0][2].includes("<table>"));
    assert.ok(visible(a).includes('<div class="tw"><table>'));
    assert.ok(html.indexOf("</details>") < html.indexOf('<div class="tw">'));
    for (const transcription of a.romaji) assert.ok(plainText(support(a)).includes(transcription.text), a.heading + ": " + transcription.text);
  }
});

test("workbook questions: printed Japanese is retained exactly, with prompts and English directions outside the reveal", () => {
  for (const a of audit.activities) {
    const cells = rows(visible(a));
    for (const q of a.questions) {
      const cell = cells[q.number - 1][1];
      assert.match(cell, /^<span lang="ja" class="reading-japanese">/);
      const primary = cell.match(/^<span[^>]*>([\s\S]*?)<\/span>/);
      assert.equal(plainText(primary[1]), q.japanese);
      assert.equal(plainText(cell.slice(primary[0].length)), q.suffix);
      const original = q.original.match(/\[([^\]]*[ぁ-んァ-ン一-龯][^\]]*)\]/);
      if (original) assert.equal(q.japanese, original[1]);
      assert.ok(!/\b(?:[a-z-]*masu|nakatta|nakatた)\b/.test(plainText(cell)));
    }
  }
  const target = audit.activities.find(a => a.heading === "c8-verb-conjugation-page-118");
  assert.match(plainText(rows(visible(target))[0][1]), /^のみます/);
  assert.ok(!visible(target).includes("nomimasu"));
  assert.ok(support(target).includes("nomimasu"));
  assert.ok(visible(target).includes("たべません"));
  const casual = audit.activities.find(a => a.heading === "c10-verb-conjugation-page-150");
  assert.ok(visible(casual).includes("なかった form"));
  assert.ok(!visible(casual).includes("nakat"));
});

test("early workbook material: Japanese exists before hiding any previously romaji-only question or passage", () => {
  const early = audit.activities.filter(a => Number(a.chapter) <= 3);
  assert.equal(early.reduce((sum, a) => sum + a.questions.length, 0), 93);
  const passages = early.flatMap(a => a.passages);
  assert.equal(passages.length, 8);
  for (const a of early) {
    for (const q of a.questions) assert.ok(/[ぁ-んァ-ン一-龯]/.test(q.japanese));
    for (const passage of a.passages) {
      assert.ok(plainText(visible(a)).includes(passage.japanese));
      assert.ok(plainText(support(a)).includes(plainText(passage.original)));
    }
  }
  const intro = early.find(a => a.heading === "c1-reading-comprehension-page-23");
  assert.deepEqual(intro.passages.map(p => p.japanese.split(":")[0]), ["サントス", "キム", "スミス"]);
  const shown = plainText(visible(intro));
  assert.ok(shown.indexOf("サントス") < shown.indexOf("キム"));
  assert.ok(shown.indexOf("キム") < shown.indexOf("スミス"));
  const hidden = plainText(support(intro));
  assert.ok(hidden.indexOf("santos:") < hidden.indexOf("kim:"));
  assert.ok(hidden.indexOf("kim:") < hidden.indexOf("smith:"));
});

test("workbook cloze passages and early comprehension readings all have readable Japanese outside support", () => {
  const withPassages = audit.activities.filter(a => a.passages.length);
  assert.equal(withPassages.length, 14);
  assert.equal(withPassages.reduce((sum, a) => sum + a.passages.length, 0), 16);
  for (const a of withPassages) {
    for (const p of a.passages) assert.ok(plainText(visible(a)).includes(p.japanese), a.heading);
    assert.equal(a.hasSupport, true);
  }
  const cloze = audit.activities.filter(a => /grammar-usage|fill-in-the-proper-word-or-phrase/.test(a.heading));
  assert.equal(cloze.length, 10);
  for (const a of cloze) {
    assert.ok(visible(a).includes("(1) ____"));
    assert.ok(visible(a).includes("(2) ____"));
    assert.ok(visible(a).includes("(3) ____"));
  }
});

test("required choices stay visible: English translation tasks, picture descriptions and adjective word bank", () => {
  const translations = audit.activities.filter(a => /translat/.test(a.heading));
  assert.equal(translations.length, 10);
  for (const a of translations) {
    assert.equal(a.hasSupport, false);
    assert.deepEqual(rows(visible(a)).map(row => plainText(row[1])), rows(a.originalHtml).map(row => plainText(row[1])));
  }
  const pictures = audit.activities.find(a => a.heading === "c2-reading-comprehension-page-38");
  assert.ok(visible(pictures).includes("a building with a bookstore"));
  assert.ok(visible(pictures).includes("FAMILY sign"));
  const bank = audit.activities.find(a => a.heading === "c6-choose-the-adjective-page-94");
  for (const term of ["さむい", "おもい", "やさしい", "つまらない", "あぶない", "かんたん", "ひろい", "まずい", "しずか", "ちいさい"]) {
    assert.ok(visible(bank).includes(term));
  }
  assert.ok(!visible(bank).includes("samui"));
});

test("workbook search: Japanese prompts and hidden romaji keep their source headings", () => {
  const index = buildSearchIndex([{ kind: "chapter", label: "Chapter", basePath: "/chapters", pages }]);
  for (const a of audit.activities.filter(a => a.questions.length)) {
    const q = a.questions[0];
    const roman = q.original.split("[")[0].trim();
    for (const query of [q.japanese, roman]) {
      const found = searchGroups(index, { q: query, category: "practice", chapter: a.chapter });
      assert.ok(found.some(group => group.occurrences.some(entry => entry.a === a.heading)), a.heading + ": " + query);
    }
  }
});

test("existing reading disclosures and vocabulary notes remain available in Chapters 5-10", () => {
  for (const passage of oldReadings.passages) {
    const html = chapterHtml(passage.chapter);
    const start = html.indexOf('<section class="reading-exercise" data-reading-exercise="' + passage.heading + '"');
    assert.ok(start >= 0);
    const reading = html.slice(start, html.indexOf("</section>", start));
    assert.equal((reading.match(/<details /g) ?? []).length, 2);
    assert.ok(plainText(reading).includes(passage.japanese));
    assert.ok(plainText(reading).includes(passage.romaji));
    assert.ok(plainText(reading).includes(passage.english));
    for (const note of passage.notes) assert.ok(reading.includes(note.japanese));
  }
});
