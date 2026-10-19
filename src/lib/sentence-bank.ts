import "server-only";
import catalog from "@/data/japanese-display.json";
import { studyDisplay } from "@/lib/study-markup";
import raw from "@/data/sentence-exercises.json";
import type { ChapterSentenceExercises, SentenceExerciseBank } from "@/types/sentence-exercise";

// Only the current chapter's small, source-checked bank crosses the client boundary.
const bank = raw as SentenceExerciseBank;
export function chapterSentenceExercises(chapter: string): ChapterSentenceExercises | null {
  const found = bank.chapters.find(item => item.chapter === chapter);
  if (!found) return null;
  const prepare = <T extends { why: string }>(question: T) => ({ ...question, displayWhy: studyDisplay(catalog, question.why) });
  return { ...found, order: found.order.map(prepare), transformations: found.transformations.map(prepare) };
}
