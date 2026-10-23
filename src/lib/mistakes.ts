// Builds "mistake" flashcards from missed practice questions. Pure data, no React.
import type { FlashcardDraft } from "@/lib/flashcards";
import type { WorkbookQuestion, WorkbookSet } from "@/types/workbook";
import type { CheckpointExam, CheckpointPart, CheckpointQuestion, CheckpointQuestionText, CheckpointTextPart } from "@/types/checkpoint";

const lines = (...values: (string | undefined)[]) => values.filter(value => value && value.trim()).join("\n");
const numbered = (choices: { id: string; text: string }[]) => choices.map(c => c.id + ". " + c.text).join("\n");

export function workbookMistake(set: WorkbookSet, q: WorkbookQuestion): FlashcardDraft {
  return {
    kind: "mistake",
    japanese: lines(q.prompt, q.choices && numbered(q.choices), q.tokens && q.tokens.join(" ／ ")),
    kana: q.model, romaji: q.romaji ?? "", meaning: q.whyEn,
    source: { key: "chapter:" + set.chapter, label: "Chapter " + set.chapter + " › " + set.title, href: "/chapters/" + set.chapter + "#" + set.heading },
  };
}

export type LegacyMistakeSource = { chapter: string; heading: string; title: string };
// Takes the displayed text of the prompt, model answer and explanation.
export function legacyMistake(source: LegacyMistakeSource, prompt: string, model: string, explanation: string): FlashcardDraft {
  return {
    kind: "mistake", japanese: prompt, kana: model, romaji: "",
    meaning: explanation || "Compare your answer with the model answer.",
    source: { key: "chapter:" + source.chapter, label: "Chapter " + source.chapter + " › " + source.title, href: "/chapters/" + source.chapter + "#" + source.heading },
  };
}

// Checkpoint cards use the same kana display the exam shows: `plain` turns a
// source string, or its prepared parts, into that displayed text.
export type CheckpointPlainText = (value: string, parts?: CheckpointTextPart[]) => string;
export function checkpointMistake(exam: CheckpointExam, part: CheckpointPart, q: CheckpointQuestion, plain: CheckpointPlainText, prepared?: CheckpointQuestionText): FlashcardDraft {
  const answer = q.choices.find(c => c.id === q.correctChoiceId)!;
  return {
    kind: "mistake",
    japanese: lines(q.context && plain(q.context, prepared?.context), plain(q.prompt, prepared?.prompt),
      numbered(q.choices.map(c => ({ id: c.id, text: plain(c.text, prepared?.choices[c.id]) })))),
    kana: answer.id + ". " + plain(answer.text, prepared?.choices[answer.id]), romaji: "",
    meaning: plain(q.explanationEn, prepared?.explanationEn),
    source: { key: "checkpoint:" + exam.id, label: "Checkpoint: " + exam.title + " › " + part.title, href: "/checkpoints/" + exam.id + "#" + q.id },
  };
}
