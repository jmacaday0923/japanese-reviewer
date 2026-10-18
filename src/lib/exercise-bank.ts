// Server-only: reads the whole exercise bank and returns one chapter's sets.
// Importing this from a client component fails the build, so the browser
// only ever gets the chapter being read, passed down as props.
import "server-only";
import raw from "@/data/exercises.json";
import type { ChapterExercises, ExerciseBank } from "@/types/exercise";

const bank = raw as ExerciseBank;

// null for chapters without interactive exercises yet
export function chapterExercises(chapter: string): ChapterExercises | null {
  return bank.chapters.find((c) => c.chapter === chapter) ?? null;
}
