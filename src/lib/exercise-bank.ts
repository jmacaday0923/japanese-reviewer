// Server-only: reads the whole exercise bank and returns one chapter's sets.
// Importing this from a client component fails the build, so the browser
// only ever gets the chapter being read, passed down as props.
import "server-only";
import catalog from "@/data/japanese-display.json";
import { studyDisplay } from "@/lib/study-markup";
import raw from "@/data/exercises.json";
import type { ChapterExercises, ExerciseBank } from "@/types/exercise";

const bank = raw as ExerciseBank;

// null for chapters without interactive exercises yet
export function chapterExercises(chapter: string): ChapterExercises | null {
  const found = bank.chapters.find((c) => c.chapter === chapter);
  if (!found) return null;
  const display = (text: string) => studyDisplay(catalog, text, `chapter/${chapter}/exercises`);
  return { ...found, sets: found.sets.map(set => ({ ...set, displayTitle: display(set.title),
    ...(set.type === "particles" ? { questions: set.questions.map(q => ({ ...q, display: {
      prompt: display(q.prompt), answer: display(q.answer), why: display(q.why),
    } })) } : { pairs: set.pairs.map(pair => ({ ...pair, display: {
      japanese: { primary: pair.kana ?? display(pair.japanese).primary, romaji: pair.japanese },
      answer: display(pair.answer), why: display(pair.why),
    } })) }),
  })) } as ChapterExercises;
}
