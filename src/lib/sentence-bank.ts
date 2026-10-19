import "server-only";
import raw from "@/data/sentence-exercises.json";
import type { ChapterSentenceExercises, SentenceExerciseBank } from "@/types/sentence-exercise";

// Only the current chapter's small, source-checked bank crosses the client boundary.
const bank = raw as SentenceExerciseBank;
export function chapterSentenceExercises(chapter: string): ChapterSentenceExercises | null {
  return bank.chapters.find(item => item.chapter === chapter) ?? null;
}
