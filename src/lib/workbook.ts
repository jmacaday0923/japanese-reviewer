import type { WorkbookQuestion } from "@/types/workbook";
import type { Grade } from "@/lib/exercises";

// Compare reviewed kana/printed forms, retaining particles, tense and long vowels.
export function normalizeWorkbook(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s、,]/g, "").replace(/[。.!！]+$/u, "");
}
export function workbookOrder(value: string, count: number): number[] | null {
  if (!value || !/^(0|[1-9]\d*)(,(0|[1-9]\d*))*$/.test(value)) return null;
  const ids = value.split(",").map(Number);
  return ids.length <= count && new Set(ids).size === ids.length && ids.every(id => id < count) ? ids : null;
}
export function gradeWorkbook(question: WorkbookQuestion, value: string): Grade | null {
  if (!value.trim()) return "blank";
  if (question.mode === "self") return null;
  if (question.mode === "choice") return (question.acceptedChoiceIds ?? [question.correctChoiceId]).includes(value) ? "correct" : "incorrect";
  if (question.mode === "order") {
    const order = workbookOrder(value, question.tokens!.length);
    if (!order) return "incorrect";
    if (order.length < question.tokens!.length) return "blank";
    return question.acceptedOrders!.some(candidate => candidate.every((id, i) => id === order[i])) ? "correct" : "incorrect";
  }
  return question.accepted!.some(answer => normalizeWorkbook(answer) === normalizeWorkbook(value)) ? "correct" : "incorrect";
}
