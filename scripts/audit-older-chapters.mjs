import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildLegacyActivities } from "../src/lib/legacy-exercises.ts";
import { parseStudyMarkup } from "../src/lib/study-markup.ts";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sha = value => createHash("sha256").update(value).digest("hex");
const chapters = JSON.parse(read("src/data/chapters.json"));
const sourceFiles = ["chapters", "japanese-display", "english-display", "exercises", "sentence-exercises", "workbook-exercises", "chapter-guides", "chapter-reading-support"];
const supports = JSON.parse(read("src/data/chapter-reading-support.json"));
const perChapter = chapters.filter(c => Number(c.ch) <= 10).map(chapter => {
  const activities = buildLegacyActivities(chapter, parseStudyMarkup);
  return {
    chapter: chapter.ch, title: chapter.title, activities: activities.length,
    questions: activities.reduce((n, a) => n + a.questions.length, 0),
    sets: activities.map(a => ({
      heading: a.heading, answerHeading: a.answerHeading, mode: a.mode,
      rows: a.questions.map(q => ({
        id: q.id, number: q.number,
        sourceSha256: sha(JSON.stringify([q.promptHtml, q.modelHtml, q.explanationHtml])),
        accepted: q.accepted,
      })),
    })),
  };
});
const counts = {};
for (const chapter of perChapter) for (const activity of chapter.sets) {
  const entry = counts[activity.mode] ??= { activities: 0, questions: 0 };
  entry.activities++; entry.questions += activity.rows.length;
}
const audit = {
  version: 1, referenceChapter: "11", referenceCommit: "c6e7c91",
  method: "Render existing question/answer table pairs as interactive practice. Preserve all original source datasets and anchors. Exact source-backed finite answers only; other tasks use model comparison.",
  sourceHashes: Object.fromEntries(sourceFiles.map(name => ["src/data/" + name + ".json", sha(read("src/data/" + name + ".json"))])),
  activities: perChapter.reduce((n, c) => n + c.activities, 0),
  questions: perChapter.reduce((n, c) => n + c.questions, 0),
  modes: counts, chapters: perChapter,
  addedTranslations: supports.activities.map(a => ({ heading: a.heading, paragraphs: a.japanese.length,
    japaneseSha256: sha(JSON.stringify(a.japanese)), englishSha256: sha(JSON.stringify(a.english)) })),
};
const path = new URL("../migration/older-chapter-audit.json", import.meta.url);
const output = JSON.stringify(audit, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output) throw Error("Older chapter source or grading policy changed. Review the models and regenerate migration/older-chapter-audit.json.");
} else writeFileSync(path, output);
console.log(JSON.stringify({ activities: audit.activities, questions: audit.questions, modes: counts, checked: process.argv.includes("--check") }));
