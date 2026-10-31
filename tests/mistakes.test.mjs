import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addFlashcards, addMistakes, EMPTY_FLASHCARDS, parseFlashcardData, reviewFlashcard, reviewQueue } from "../src/lib/flashcards.ts";
import { workbookMistake, legacyMistake, checkpointMistake } from "../src/lib/mistakes.ts";
import { buildLegacyActivities } from "../src/lib/legacy-exercises.ts";
import { parseStudyMarkup, prepareExerciseDisplay, exerciseDisplayText } from "../src/lib/study-markup.ts";
import { checkpointTextParts } from "../src/lib/checkpoint-display.ts";
import { buildChapter10Presentation, kanji1Characters } from "../src/lib/chapter-10-checkpoint.ts";
const load = name => JSON.parse(readFileSync(new URL("../src/data/" + name + ".json", import.meta.url), "utf8"));
const sets = load("workbook-exercises").chapters.flatMap(c => c.sets);
const exams = load("checkpoint-exams"), catalog = load("japanese-display");
const chapter5 = load("chapter-5-checkpoint-display"), policy = load("chapter-10-checkpoint-display");
const presentation = exam => exam.id === chapter5.examId ? chapter5
  : policy.exams[exam.id] ? buildChapter10Presentation(exam, policy, kanji1Characters(load("kanji")[0])) : undefined;
const plainFor = shown => (value, parts) => (parts ?? checkpointTextParts(value, shown)).map(p => p.text).join("");
const mistakeFor = (exam, part, q, shown) => checkpointMistake(exam, part, q, plainFor(shown), shown?.prepared?.questions[q.id]);
const valid = drafts => { const result = addFlashcards(EMPTY_FLASHCARDS, drafts, 1000); return result.skipped === 0 && result.added === new Set(drafts.map(d => JSON.stringify([d.japanese, d.kana, d.meaning]))).size; };

test("every workbook question (Chapters 11 to 14) makes a valid mistake card linked to its exercise", () => {
  const drafts = sets.flatMap(set => set.questions.map(q => workbookMistake(set, q)));
  assert.equal(drafts.length, sets.reduce((sum, set) => sum + set.questions.length, 0));
  assert.ok(valid(drafts));
  const choice = workbookMistake(sets.find(s => s.id === "c11-change-choices"), sets.find(s => s.id === "c11-change-choices").questions[0]);
  assert.match(choice.japanese, /\n1\. きれいな\n2\. きれいで/);
  assert.equal(choice.kana, "きれいに");
  assert.equal(choice.source.href, "/chapters/11#c11-change-choices");
});

test("every checkpoint question makes a valid card in the kana the exam shows, linked to the question", () => {
  for (const exam of exams) {
    const shown = presentation(exam);
    const drafts = exam.parts.flatMap(p => p.questions.map(q => mistakeFor(exam, p, q, shown)));
    assert.ok(valid(drafts), exam.id);
    const [part] = exam.parts, q = part.questions[0], card = mistakeFor(exam, part, q, shown);
    assert.equal(card.source.key, "checkpoint:" + exam.id);
    assert.equal(card.source.href, "/checkpoints/" + exam.id + "#" + q.id);
    assert.ok(card.kana.startsWith(q.correctChoiceId + ". "));
  }
  const exam = exams.find(e => e.id === chapter5.examId), q = exam.parts[0].questions.find(q => chapter5.kana[q.prompt]);
  if (q) assert.ok(mistakeFor(exam, exam.parts[0], q, chapter5).japanese.includes(checkpointTextParts(q.prompt, chapter5).map(p => p.text).join("")));
});

test("older chapter exercises make valid cards from the displayed prompt, model and explanation", () => {
  let count = 0;
  for (const chapter of load("chapters").filter(c => c.ch !== "11")) for (const activity of buildLegacyActivities(chapter, parseStudyMarkup)) {
    const scope = "chapter/" + chapter.ch + "/exercises", answers = "chapter/" + chapter.ch + "/answers";
    const drafts = activity.questions.map(q => legacyMistake({ chapter: chapter.ch, heading: activity.heading, title: activity.title },
      ...[[q.promptHtml, scope], [q.modelHtml, answers], [q.explanationHtml, answers]].map(([html, s]) => exerciseDisplayText(prepareExerciseDisplay(parseStudyMarkup(html), catalog, s)))));
    const result = addFlashcards(EMPTY_FLASHCARDS, drafts, 1000);
    assert.equal(result.skipped, 0, activity.heading);
    count += drafts.length;
  }
  assert.equal(count, 3166);
});

test("a repeated mistake comes back for review now and keeps its history; mistakes skip English → Japanese", () => {
  const set = sets[0], draft = workbookMistake(set, set.questions[0]);
  let data = addMistakes(EMPTY_FLASHCARDS, [draft], 1000);
  assert.equal(data.cards.length, 1);
  assert.equal(addMistakes(data, [draft], 2000), data);
  const id = data.cards[0].id;
  data = reviewFlashcard(data, id, "recognition", "easy", 3000, 0);
  assert.ok(data.cards[0].progress.recognition.dueAt > 5000);
  const again = addMistakes(data, [draft], 5000);
  assert.equal(again.cards[0].progress.recognition.dueAt, 5000);
  assert.equal(again.cards[0].progress.recognition.reviews, 1);
  assert.equal(reviewQueue(again, "recognition", [], 6000).dueCount, 1);
  assert.equal(reviewQueue(again, "recall", [], 6000).totalCount, 0);
  assert.equal(addMistakes(EMPTY_FLASHCARDS, [{ ...draft, kind: "vocabulary" }], 1000), EMPTY_FLASHCARDS);
});

test("saved mistake cards and checkpoint sources survive a reload; unknown routes are still rejected", () => {
  const exam = exams[0], card = mistakeFor(exam, exam.parts[0], exam.parts[0].questions[0]);
  const data = addMistakes(EMPTY_FLASHCARDS, [card, workbookMistake(sets[0], sets[0].questions[1])], 1000);
  assert.deepEqual(parseFlashcardData(JSON.stringify(data)), data);
  for (const href of ["/checkpoints/vocabulary", "/listening/1#a", "/checkpoints/../x", "https://example.com/chapters/1#a"]) {
    const result = addFlashcards(EMPTY_FLASHCARDS, [{ ...card, source: { ...card.source, href } }], 1000);
    assert.equal(result.skipped, href === "/checkpoints/vocabulary" ? 0 : 1, href);
  }
});
