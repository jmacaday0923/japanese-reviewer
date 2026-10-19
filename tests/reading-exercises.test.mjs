import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSearchIndex, searchGroups, plainText } from "../src/lib/search.ts";
import { anchorIds } from "../src/lib/toc.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pages = JSON.parse(read("src/data/chapters.json"));
const audit = JSON.parse(read("migration/reading-exercise-audit.json"));
const exerciseHtml = chapter => pages.find(page => page.ch === chapter).sections.find(section => section.id === "exercises").html;
function block(passage) {
  const html = exerciseHtml(passage.chapter);
  const start = html.indexOf('<section class="reading-exercise" data-reading-exercise="' + passage.heading + '"');
  assert.ok(start >= 0, passage.heading);
  const end = html.indexOf("</section>", start);
  assert.ok(end > start);
  return html.slice(start, end + "</section>".length);
}
const paragraphs = html => [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => plainText(match[1]));

test("reading exercises: all twelve Chapter 5-10 passages and 58 questions are covered at the existing headings", () => {
  assert.equal(audit.version, 1);
  assert.equal(audit.passages.length, 12);
  assert.equal(audit.passages.reduce((sum, passage) => sum + passage.questions.length, 0), 58);
  assert.equal(new Set(audit.passages.map(passage => passage.heading)).size, 12);
  for (const page of pages) {
    const count = (exerciseHtml(page.ch).match(/data-reading-exercise=/g) ?? []).length;
    assert.equal(count, Number(page.ch) >= 5 ? 2 : 0);
    if (Number(page.ch) < 5) continue;
    const headings = [...exerciseHtml(page.ch).matchAll(/<h([34]) id="([^"]+)">([^<]+)<\/h\1>/g)]
      .filter(match => /^(Part [A-Z]+: Read and answer|Reading comprehension|Read and answer)/.test(match[3]));
    assert.deepEqual(headings.map(match => match[2]), audit.passages.filter(passage => passage.chapter === page.ch).map(passage => passage.heading));
    for (const passage of audit.passages.filter(passage => passage.chapter === page.ch)) {
      if (passage.level === 3) assert.ok(page.toc.some(entry => entry.a === passage.heading));
      assert.equal(anchorIds(exerciseHtml(page.ch)).filter(id => id === passage.heading).length, 1);
      assert.ok(block(passage).includes("<h" + passage.level + ' id="' + passage.heading + '">'));
    }
  }
});

test("reading exercises: romaji and English disclosures are independently closed in the source, without hydration", () => {
  for (const passage of audit.passages) {
    const html = block(passage);
    const details = [...html.matchAll(/<details([^>]*)>([\s\S]*?)<\/details>/g)];
    assert.equal(details.length, 2);
    assert.deepEqual(details.map(match => match[1].match(/data-reading-support="([^"]+)"/)[1]), ["romaji", "english"]);
    assert.ok(details.every(match => !/\bopen(?:\s|=|$)/.test(match[1])));
    assert.deepEqual(paragraphs(details[0][2]), [passage.romaji]);
    assert.deepEqual(paragraphs(details[1][2]), [passage.english]);
    assert.match(details[0][2], /<summary>Romaji support \(optional\)<\/summary>/);
    assert.match(details[1][2], /<summary>English translation \(optional\)<\/summary>/);
    assert.ok(!/<script\b|\bonclick=|\bstyle=/i.test(html));
  }
});

test("reading exercises: Japanese passage text is preserved, with Japanese time ranges in the schedule", () => {
  for (const passage of audit.passages) {
    const old = paragraphs(passage.originalHtml)[1];
    const expected = old.replace("10:30 to 10:40", "10:30から10:40まで").replace("12:00 to 13:00", "12:00から13:00まで");
    assert.equal(passage.japanese, expected);
    const match = block(passage).match(/<div class="reading-passage">([\s\S]*?)<\/div>/);
    assert.deepEqual(paragraphs(match[1]), [expected]);
    assert.match(match[1], /lang="ja" class="reading-japanese"/);
    assert.ok(!/[A-Za-z]/.test(expected.replace(/N[345]/g, "")));
    assert.equal(passage.romaji, paragraphs(passage.originalHtml)[2]);
  }
});

test("reading exercises: primary questions and all multiple-choice options use Japanese rather than a romaji prefix", () => {
  for (const passage of audit.passages) {
    const questionHtml = block(passage).match(/<div class="tw reading-questions">([\s\S]*?)<\/div>/)[1];
    const rows = [...questionHtml.matchAll(/<tr><td>(\d+)<\/td><td>([\s\S]*?)<\/td><td><\/td><\/tr>/g)];
    assert.equal(rows.length, passage.questions.length);
    rows.forEach((row, index) => {
      const question = passage.questions[index];
      assert.equal(Number(row[1]), index + 1);
      assert.equal(plainText(row[2]), question.japanese);
      assert.match(row[2], /lang="ja" class="reading-japanese"/);
      assert.ok(!/[A-Za-z]/.test(question.japanese.replace(/N[345]/g, "")), question.japanese);
      const printed = question.original.match(/\[([^\]]+)\]$/);
      if (printed) assert.equal(question.japanese, printed[1]);
      if (question.original.includes("(1 ")) {
        assert.ok(/\(1 [\s\S]+, 2 [\s\S]+, 3 [\s\S]+, 4 [\s\S]+\)/.test(question.japanese));
      }
    });
  }
  assert.ok(audit.passages.find(p => p.heading === "c5-part-v-read-and-answer").questions[6].japanese.includes("おうふく"));
  assert.ok(audit.passages.find(p => p.heading === "c9-part-x-read-and-answer").questions[4].japanese.includes("どうやって"));
});

test("reading vocabulary audit: every taught-word reference points to evidence in current or earlier Lessons/Vocabulary", () => {
  let references = 0;
  for (const passage of audit.passages) {
    for (const item of passage.knownVocabulary) {
      const source = item.source;
      assert.ok(Number(source.chapter) <= Number(passage.chapter), item.term);
      assert.ok(["lessons", "vocab"].includes(source.section));
      const page = pages.find(page => page.ch === source.chapter);
      const section = page.sections.find(section => section.id === source.section);
      const start = section.html.indexOf('id="' + source.heading + '"');
      assert.ok(start >= 0, source.heading);
      const next = section.html.indexOf("<h", section.html.indexOf(">", start) + 1);
      const content = section.html.slice(start, next < 0 ? undefined : next);
      const text = plainText(content);
      for (const evidence of item.evidence) assert.ok(text.includes(evidence), item.term + ": " + evidence);
      references++;
    }
  }
  assert.equal(references, 247);
  const sakura = audit.passages.find(p => p.chapter === "10" && p.level === 4).knownVocabulary.find(item => item.term === "さくら");
  assert.equal(sakura.source.chapter, "10");
  assert.ok(sakura.evidence.some(value => value.includes("cherry blossoms")));
  const osoku = audit.passages.find(p => p.chapter === "7" && p.level === 3).knownVocabulary.find(item => item.term === "おそく");
  assert.equal(osoku.source.section, "lessons");
  assert.equal(osoku.source.chapter, "7");
});

test("reading vocabulary notes: only untaught expressions are glossed directly below the passage", () => {
  const notes = audit.passages.flatMap(passage => passage.notes);
  assert.deepEqual(notes.map(note => note.japanese), ["これから"]);
  for (const passage of audit.passages) {
    const html = block(passage);
    assert.ok(!html.includes("Words:"));
    if (!passage.notes.length) {
      assert.ok(!html.includes('aria-label="Vocabulary notes"'));
      continue;
    }
    const notesStart = html.indexOf('<aside class="reading-vocabulary"');
    assert.ok(notesStart > html.indexOf('<div class="reading-passage">'));
    assert.ok(notesStart < html.indexOf('<div class="reading-support">'));
    for (const note of passage.notes) {
      assert.ok((passage.japanese + " " + passage.questions.map(q => q.japanese).join(" ")).includes(note.japanese));
      for (const page of pages.filter(page => Number(page.ch) <= Number(passage.chapter))) {
        for (const section of page.sections.filter(section => ["lessons", "vocab"].includes(section.id))) {
          assert.ok(!plainText(section.html).replace(/\s+/g, "").includes(note.japanese), note.japanese);
        }
      }
      assert.ok(html.includes(note.meaning));
      assert.match(note.reference, /^https:\/\/marugoto\.jpf\.go\.jp\//);
    }
  }
  assert.equal(audit.passages.find(p => p.heading === "c8-part-v-read-and-answer").notes.length, 0);
});

test("reading search: hidden support remains searchable and Japanese questions link to their original headings", () => {
  const index = buildSearchIndex([{ kind: "chapter", label: "Chapter", basePath: "/chapters", pages }]);
  for (const passage of audit.passages) {
    for (const query of [passage.japanese, passage.romaji, passage.english, passage.questions[0].japanese]) {
      const found = searchGroups(index, { q: query, category: "practice", chapter: passage.chapter });
      assert.ok(found.some(group => group.occurrences.some(entry => entry.a === passage.heading)), passage.heading + ": " + query.slice(0, 30));
    }
  }
});

test("reading scope: exercise heading order and original answer-key targets remain intact", () => {
  for (const passage of audit.passages) {
    const page = pages.find(page => page.ch === passage.chapter);
    const answers = page.sections.find(section => section.id === "answers");
    assert.ok(anchorIds(answers.html).includes(passage.heading + "-2"));
    const html = block(passage);
    assert.equal((html.match(/<tbody>/g) ?? []).length, 1);
    assert.equal((html.match(/<td><\/td>/g) ?? []).length, passage.questions.length);
  }
  assert.ok(!read("src/data/practice.json").includes("data-reading-exercise="));
  assert.ok(!read("src/data/kana.json").includes("data-reading-exercise="));
  assert.ok(!read("src/data/kanji.json").includes("data-reading-exercise="));
});
