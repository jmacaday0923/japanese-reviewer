import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeSentence, tokenOrder, gradeWordOrder, gradeTransformation, printedSentenceForms, acceptedSentences, modelSentence } from "../src/lib/sentence-exercises.ts";
import { createActivity, editAnswer, applyGrades, retryIncorrect, restartActivity, summarize, stableShuffle } from "../src/lib/exercises.ts";

const load = name => JSON.parse(readFileSync(new URL("../src/data/" + name, import.meta.url), "utf8"));
const bank = load("sentence-exercises.json"), chapters = load("chapters.json");
const all = bank.chapters.flatMap(chapter => [...chapter.order, ...chapter.transformations].map(question => ({ chapter: chapter.chapter, question })));
const transforms = all.filter(item => item.question.type === "transform");
const decode = value => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function part(chapter, heading) {
  const page = chapters.find(item => item.ch === chapter);
  const html = page.sections.find(section => section.id === "lessons").html;
  const at = html.indexOf('<h3 id="' + heading + '">');
  assert.notEqual(at, -1, heading);
  assert.ok(page.toc.some(item => item.a === heading), heading + " has an outline link");
  const start = html.indexOf("</h3>", at) + 5, next = html.indexOf("<h3 ", start);
  return html.slice(start, next < 0 ? undefined : next);
}
function sourceExample(chapter, example) {
  const { heading, table, row, variant } = example.source;
  const tables = [...part(chapter, heading).matchAll(/<div class="tw"><table>([\s\S]*?)<\/table><\/div>/g)];
  assert.ok(tables[table - 1], heading + " table");
  const rows = [...tables[table - 1][1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map(match => [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => decode(cell[1]))).filter(cells => cells.length);
  let cells = rows[row - 1];
  assert.ok(cells, heading + " row");
  if (variant !== undefined) {
    const count = cells[0].split(" / ").length;
    cells = cells.map(value => value.split(" / ").length === count ? value.split(" / ")[variant] : value);
  }
  assert.equal(example.japanese, cells[0]);
  assert.equal(example.romaji, cells[1]);
  assert.equal(example.english, cells[2]);
}

test("sentence bank: three puzzles per chapter and twelve source-backed transformations", () => {
  assert.equal(bank.version, 1);
  assert.deepEqual(bank.chapters.map(chapter => chapter.chapter), chapters.map(chapter => chapter.ch));
  assert.ok(bank.chapters.every(chapter => chapter.order.length === 3));
  assert.equal(all.length, 42);
  assert.deepEqual(bank.chapters.filter(chapter => chapter.transformations.length).map(chapter => [chapter.chapter, chapter.transformations.length]), [["1", 2], ["6", 4], ["10", 6]]);
  assert.ok(transforms.some(item => item.question.change === "negative"));
  assert.ok(transforms.some(item => item.question.change === "casual"));
});
test("sentence bank: every prompt, model answer and explanation is present in its cited lesson", () => {
  for (const { chapter, question } of all) {
    if (question.type === "order") sourceExample(chapter, question.example);
    else { sourceExample(chapter, question.original); sourceExample(chapter, question.answer); }
    const example = question.type === "order" ? question.example : question.answer;
    const paragraphs = [...part(chapter, example.source.heading).matchAll(/<p>([\s\S]*?)<\/p>/g)];
    assert.ok(Number.isInteger(question.whyParagraph) && question.whyParagraph >= 1);
    const explanation = paragraphs[question.whyParagraph - 1];
    assert.ok(explanation);
    assert.equal(question.why, decode(explanation[1]), question.id);
  }
});
test("sentence bank: identities are unique, word tiles rebuild their source and question payloads contain no HTML", () => {
  assert.equal(new Set(all.map(item => item.question.id)).size, all.length);
  for (const { chapter, question } of all) {
    assert.ok(question.id.startsWith("sb-c" + chapter + "-"));
    assert.ok(question.why.trim());
    assert.ok(!JSON.stringify(question).includes("<"));
    if (question.type === "order") {
      assert.ok(question.tokens.length >= 3);
      assert.ok(question.tokens.every(token => token.trim()));
      assert.equal(normalizeSentence(question.tokens.join("")), normalizeSentence(question.example.japanese));
    }
  }
});
test("sentence grading: every canonical model is accepted and every untransformed prompt is rejected", () => {
  for (const { question } of all) {
    if (question.type === "order") assert.equal(gradeWordOrder(question, question.tokens.map((_, index) => index).join(",")), "correct", question.id);
    else {
      for (const form of [...printedSentenceForms(question.answer.japanese), ...printedSentenceForms(question.answer.romaji)])
        assert.equal(gradeTransformation(question, form), "correct", question.id + ": " + form);
      assert.equal(gradeTransformation(question, question.original.japanese), "incorrect", question.id);
      assert.equal(gradeTransformation(question, question.original.romaji), "incorrect", question.id);
    }
  }
});
test("sentence normalization: handles width, case, spacing and final stops while retaining grammatical distinctions", () => {
  assert.equal(normalizeSentence(" ＷＡＴＡＳＨＩ　WA にほんじん。 "), "watashiwaにほんじん");
  assert.equal(normalizeSentence("が くせいです."), "がくせいです");
  assert.notEqual(normalizeSentence("がくせいですか？"), normalizeSentence("がくせいです"));
  assert.notEqual(normalizeSentence("ko-hi-"), normalizeSentence("kohi"));
  assert.notEqual(normalizeSentence("は"), normalizeSentence("わ"));
  assert.notEqual(normalizeSentence("いった"), normalizeSentence("いかない"));
});
test("word order: incomplete answers are ungraded; malformed or reused tile ids are rejected", () => {
  const question = bank.chapters[0].order[0];
  for (const value of ["", " ", "0", "0,1"]) assert.equal(gradeWordOrder(question, value), "blank");
  for (const value of ["0,0,2,3", "-1,0,1,2", "0,1,2,99", "a", "0,,1", "0.5,1", "00"]) assert.equal(tokenOrder(value, question.tokens.length), null);
  assert.equal(gradeWordOrder(question, "1,0,2,3"), "incorrect");
  assert.equal(gradeWordOrder(question, "0,1,2,3"), "correct");
});
test("word order: identical text has independent tile identities and either identical-tile order is valid", () => {
  const question = { tokens: ["の", "の", "ほん"], example: { japanese: "ののほん" } };
  assert.equal(gradeWordOrder(question, "0,1,2"), "correct");
  assert.equal(gradeWordOrder(question, "1,0,2"), "correct");
  assert.equal(gradeWordOrder(question, "0,0,2"), "incorrect");
  const ids = question.tokens.map((_, id) => id);
  assert.deepEqual(stableShuffle(ids, "sentence"), stableShuffle(ids, "sentence"));
  assert.notDeepEqual(stableShuffle(ids, "sentence"), ids);
});
test("transformations: both documented negative copulas work, with polite style and tense preserved", () => {
  const question = bank.chapters[0].transformations[0];
  for (const answer of ["わたしはにほんじんじゃありません", "わたしは にほんじんでは ありません。", "WATASHI WA NIHONJIN JA ARIMASEN."])
    assert.equal(gradeTransformation(question, answer), "correct");
  for (const answer of ["わたしはにほんじんじゃない", "わたしはにほんじんではありませんでした", "watashi ga nihonjin ja arimasen"])
    assert.equal(gradeTransformation(question, answer), "incorrect");
});
test("transformations: source-backed adjective exceptions and na-adjectives stay distinct", () => {
  const questions = bank.chapters.find(chapter => chapter.chapter === "6").transformations;
  const good = questions.find(question => question.original.japanese.startsWith("いい"));
  assert.match(good.why, /irregular adjective/);
  assert.equal(gradeTransformation(good, "よくないです"), "correct");
  assert.equal(gradeTransformation(good, "いいくないです"), "incorrect");
  const clean = questions.find(question => question.original.japanese.startsWith("きれい"));
  assert.equal(gradeTransformation(clean, "きれいじゃありません"), "correct");
  assert.equal(gradeTransformation(clean, "きれいではありません"), "correct");
  assert.equal(gradeTransformation(clean, "きれくないです"), "incorrect");
});
test("transformations: optional source particles accept inclusion or omission without dropping other words", () => {
  const question = bank.chapters.find(chapter => chapter.chapter === "10").transformations.find(question => question.answer.japanese.includes("たべる"));
  for (const answer of ["にほんのりょうりをたべる", "にほんのりょうりたべる", "nihon no ryouri o taberu", "nihon no ryouri taberu"])
    assert.equal(gradeTransformation(question, answer), "correct");
  for (const answer of ["にほんりょうりたべる", "たべる", "nihon no ryouri o tabemasu", "nihon no ryouri ga taberu"])
    assert.equal(gradeTransformation(question, answer), "incorrect");
  assert.equal(modelSentence(question.answer.japanese), "にほんの りょうりを たべる。");
});
test("transformations: changing a past sentence to negative retains the past", () => {
  const question = bank.chapters.find(chapter => chapter.chapter === "10").transformations.find(question => question.original.japanese.includes("へんじした"));
  assert.equal(gradeTransformation(question, "たなかさんにへんじしなかった"), "correct");
  assert.equal(gradeTransformation(question, "たなかさんにへんじしない"), "incorrect");
  assert.equal(gradeTransformation(question, "  "), "blank");
  assert.equal(new Set(acceptedSentences(question)).size, acceptedSentences(question).length);
});
test("sentence practice progress: retry preserves correct answers and first score; restart resets and changes shuffle seed", () => {
  const questions = bank.chapters[0].order;
  let state = createActivity(questions.map(question => question.id));
  for (const [index, question] of questions.entries()) {
    const answer = question.tokens.map((_, id) => id);
    if (index === 1) [answer[0], answer[1]] = [answer[1], answer[0]];
    state = editAnswer(state, question.id, answer.join(","));
    state = applyGrades(state, { [question.id]: gradeWordOrder(question, state.progress[question.id].value) });
  }
  assert.deepEqual(summarize(state).firstTry, { correct: 2, total: 3 });
  assert.equal(summarize(state).canRetry, true);
  const retry = retryIncorrect(state);
  assert.deepEqual(retry.progress[questions[0].id], state.progress[questions[0].id]);
  assert.equal(retry.progress[questions[1].id].value, "");
  assert.deepEqual(summarize(retry).firstTry, { correct: 2, total: 3 });
  const reset = restartActivity(retry);
  assert.equal(reset.attempt, state.attempt + 1);
  assert.equal(summarize(reset).firstTry, null);
});
