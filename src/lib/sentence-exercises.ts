// Pure grading helpers. Answers come from the curated bank, never generated conjugations.
import type { TransformationQuestion, WordOrderQuestion } from "../types/sentence-exercise";
import type { Grade } from "./exercises";

// Spaces, letter case and a final full stop do not change an answer.
// Keep particles, long vowels, tense, question marks and spelling significant.
export function normalizeSentence(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[.。]+$/u, "");
}

export function tokenOrder(value: string, count: number): number[] | null {
  if (!value.trim()) return [];
  const pieces = value.split(",");
  if (pieces.some(piece => !/^(0|[1-9]\d*)$/.test(piece))) return null;
  const ids = pieces.map(Number);
  return ids.length <= count && new Set(ids).size === ids.length &&
    ids.every(id => Number.isSafeInteger(id) && id >= 0 && id < count) ? ids : null;
}

export function gradeWordOrder(question: Pick<WordOrderQuestion, "tokens" | "example">, value: string): Grade {
  const ids = tokenOrder(value, question.tokens.length);
  if (!ids) return "incorrect";
  if (ids.length < question.tokens.length) return "blank";
  return normalizeSentence(ids.map(id => question.tokens[id]).join("")) === normalizeSentence(question.example.japanese)
    ? "correct" : "incorrect";
}

// Expand only alternatives explicitly printed in the answer cell.
export function printedSentenceForms(value: string): string[] {
  return value.split(" / ").flatMap(part => {
    let forms = [part];
    const optional = /[（(]([^()（）]+)[)）]/u;
    while (forms.some(form => optional.test(form))) {
      forms = forms.flatMap(form => {
        const match = form.match(optional);
        return match ? [form.replace(optional, match[1]), form.replace(optional, "")] : [form];
      });
    }
    return forms;
  });
}

export function acceptedSentences(question: Pick<TransformationQuestion, "answer">): string[] {
  const source = [...printedSentenceForms(question.answer.japanese), ...printedSentenceForms(question.answer.romaji)];
  const forms = new Set(source.map(normalizeSentence));
  // The noun/na-adjective lessons explicitly allow both negative copulas.
  for (const value of [...forms]) {
    if (value.endsWith("ではありません")) forms.add(value.replace(/ではありません$/u, "じゃありません"));
    if (value.endsWith("じゃありません")) forms.add(value.replace(/じゃありません$/u, "ではありません"));
    if (value.endsWith("dewaarimasen")) forms.add(value.replace(/dewaarimasen$/, "jaarimasen"));
    if (value.endsWith("jaarimasen")) forms.add(value.replace(/jaarimasen$/, "dewaarimasen"));
  }
  return [...forms];
}

export function gradeTransformation(question: Pick<TransformationQuestion, "answer">, value: string): Grade {
  const normalized = normalizeSentence(value);
  return !normalized ? "blank" : acceptedSentences(question).includes(normalized) ? "correct" : "incorrect";
}

export function modelSentence(value: string): string {
  return printedSentenceForms(value)[0];
}
