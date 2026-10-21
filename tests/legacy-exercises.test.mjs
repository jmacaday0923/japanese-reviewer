import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { buildLegacyActivities, legacyNodeBindings, studyNodeHtml, studyNodeText } from "../src/lib/legacy-exercises.ts";
import { parseStudyMarkup } from "../src/lib/study-markup.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { gradeParticle } from "../src/lib/exercises.ts";
import { normalizeWorkbook } from "../src/lib/workbook.ts";
import { prepareExerciseDisplay } from "../src/lib/study-markup.ts";
const load = name => JSON.parse(readFileSync(new URL("../src/data/" + name + ".json", import.meta.url), "utf8"));
const chapters = load("chapters");
const activities = chapters.flatMap(c => buildLegacyActivities(c, parseStudyMarkup));
const find = heading => activities.find(a => a.heading === heading);

test("deferred model display preserves scoped Japanese, markup and independent optional romaji", () => {
  const catalog = { texts: { tabemasu: "たべます", nomimasu: "のみます" }, overrides: { answers: { tabemasu: "食べます" } } };
  const nodes = parseStudyMarkup('<strong class="model">tabemasu</strong><br><details><summary>Romaji</summary>nomimasu</details>');
  const original = structuredClone(nodes);
  assert.deepEqual(prepareExerciseDisplay(nodes, catalog, "answers"), [
    { tag: "strong", attrs: { class: "model" }, children: [{ display: { primary: "食べます", romaji: "tabemasu" } }] },
    { tag: "br", attrs: {}, children: [] },
    { tag: "details", attrs: {}, children: [{ tag: "summary", attrs: {}, children: [{ text: "Romaji" }] }, { text: "nomimasu" }] },
  ]);
  assert.deepEqual(nodes, original);
});

test("all 291 older chapter tables and 3166 questions have matching answer rows without source mutation", () => {
  const original = JSON.stringify(chapters);
  const counts = chapters.slice(0, 10).map(c => {
    const own = buildLegacyActivities(c, parseStudyMarkup);
    return [own.length, own.reduce((n, a) => n + a.questions.length, 0)];
  });
  assert.deepEqual(counts, [[16,113],[16,110],[21,203],[26,262],[30,286],[37,377],[35,376],[34,398],[40,471],[36,570]]);
  assert.equal(activities.length, 291);
  assert.equal(new Set(activities.flatMap(a => a.questions.map(q => q.id))).size, 3166);
  assert.equal(JSON.stringify(chapters), original);
  assert.deepEqual(buildLegacyActivities(chapters.at(-1), parseStudyMarkup), []);
  for (const a of activities) {
    assert.ok(a.instructionsJa && a.instructionsEn);
    const chapter = chapters.find(c => c.sections.some(s => s.id === "exercises" && s.html.includes('id="' + a.heading + '"')));
    assert.ok(chapter.sections.find(s => s.id === "answers").html.includes('id="' + a.answerHeading + '"'));
    for (const q of a.questions) assert.ok(q.promptHtml && q.modelHtml && q.explanationHtml);
  }
});

test("only finite source-keyed choices, particles and explicitly printed kana forms are checked automatically", () => {
  const modes = Object.fromEntries(["choice", "particle", "kana", "self"].map(mode => [mode, activities.filter(a => a.mode === mode).reduce((n, a) => n + a.questions.length, 0)]));
  assert.deepEqual(modes, { choice: 168, particle: 84, kana: 436, self: 2478 });
  for (const a of activities) for (const q of a.questions) {
    assert.equal(q.accepted.length > 0, a.mode !== "self");
    if (a.mode === "choice") {
      assert.deepEqual(q.accepted, [parseStudyMarkup(q.modelHtml).map(studyNodeText).join("").trim()[0]]);
      assert.equal(gradeParticle(q, q.accepted[0]), "correct");
      assert.equal(gradeParticle(q, String(Number(q.accepted[0]) % 4 + 1)), "incorrect");
    }
    if (a.mode === "kana") {
      const source = parseStudyMarkup(q.modelHtml).map(studyNodeText).join("");
      assert.ok(source.includes(q.accepted[0]) && source.includes(q.accepted[1]));
      assert.match(q.accepted[0], /^[ぁ-ゖァ-ヺー ]+$/u);
      assert.equal(normalizeWorkbook("　" + q.accepted[0] + "。"), normalizeWorkbook(q.accepted[0]));
    }
  }
  const marker = find("c1-part-a-fill-in-the-marker-wa-no-to-ka-or").questions[0];
  assert.equal(gradeParticle(marker, "は"), "correct");
  assert.equal(gradeParticle(marker, "わ"), "incorrect");
  assert.equal(gradeParticle(marker, "  "), "blank");
});

test("open Japanese and translations use model comparison instead of rejecting other valid wording", () => {
  for (const id of ["c1-part-b-make-the-sentence-negative", "c8-part-u-answer-the-question", "c10-verb-conjugation-page-150", "c2-translation-page-39"]) {
    const a = find(id); assert.ok(a, id); assert.equal(a.mode, "self", id);
    assert.ok(a.questions.every(q => q.accepted.length === 0));
  }
});

test("source serializer preserves text, Japanese language tags, blanks and choice numbers", () => {
  const html = '<span lang="ja">何を ____ か。 (1 本, 2 車)</span><br>&quot;A &amp; B&quot;';
  const nodes = parseStudyMarkup(html);
  const rebuilt = parseStudyMarkup(nodes.map(studyNodeHtml).join(""));
  assert.deepEqual(rebuilt, nodes);
  for (const a of activities) for (const q of a.questions) {
    const nodes = parseStudyMarkup(q.promptHtml);
    assert.deepEqual(parseStudyMarkup(nodes.map(studyNodeHtml).join("")), nodes);
  }
});

test("the actual reader blocks bind every old table and exactly one bilingual instruction per activity", () => {
  for (const chapter of chapters.slice(0, 10)) {
    const own = buildLegacyActivities(chapter, parseStudyMarkup);
    const bound = splitReadingContent(chapter.sections.find(s => s.id === "exercises").html)
      .filter(b => b.type === "html").flatMap(b => [...legacyNodeBindings(parseStudyMarkup(b.html), own).values()]);
    assert.deepEqual(bound.filter(b => b.kind === "table").map(b => b.activity.heading), own.map(a => a.heading));
    assert.equal(bound.filter(b => b.showInstructions).length, own.length);
  }
});

test("a missing model is a build error rather than a silently unanswerable activity", () => {
  const changed = structuredClone(chapters[0]);
  changed.sections.find(s => s.id === "answers").html = "";
  assert.throws(() => buildLegacyActivities(changed, parseStudyMarkup), /Exercise\/answer coverage differs/);
});

test("all chapter study plans have three goals and preserve the current chapter order", () => {
  const guides = load("chapter-guides");
  assert.deepEqual(guides.chapters.map(c => c.chapter), chapters.map(c => c.ch));
  assert.ok(guides.chapters.every(c => c.goals.length === 3 && c.goals.every(g => g.trim())));
  assert.match(guides.chapters.find(c => c.chapter === "10").note, /五段.*一段/u);
});

test("fourteen added passage translations bind below Japanese and retain every cloze blank", () => {
  const supports = load("chapter-reading-support").activities;
  assert.equal(supports.length, 14);
  assert.equal(supports.reduce((n, a) => n + a.japanese.length, 0), 16);
  const bound = [];
  for (const c of chapters.slice(0, 10)) {
    const acts = buildLegacyActivities(c, parseStudyMarkup).map(a => ({ ...a, readingSupport: supports.find(s => s.heading === a.heading) }));
    for (const block of splitReadingContent(c.sections.find(s => s.id === "exercises").html).filter(b => b.type === "html"))
      bound.push(...[...legacyNodeBindings(parseStudyMarkup(block.html), acts).values()].filter(b => b.kind === "translation"));
  }
  assert.deepEqual(bound.map(b => b.activity.heading), supports.map(s => s.heading));
  for (const support of supports) {
    assert.equal(support.japanese.length, support.english.length);
    const blanks = text => [...text.matchAll(/\([1-4]\)\s*_{4}/g)].map(m => m[0].replace(/\s/g, ""));
    assert.deepEqual(blanks(support.english.join(" ")), blanks(support.japanese.join(" ")), support.heading);
  }
});

test("the complete source and acceptance-policy audit is current", () => {
  const path = new URL("../migration/older-chapter-audit.json", import.meta.url);
  const audit = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(audit.activities, 291); assert.equal(audit.questions, 3166);
  for (const [file, expected] of Object.entries(audit.sourceHashes))
    assert.equal(createHash("sha256").update(readFileSync(new URL("../" + file, import.meta.url))).digest("hex"), expected);
  execFileSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/audit-older-chapters.mjs", "--check"], { cwd: new URL("../", import.meta.url), stdio: "pipe" });
});
