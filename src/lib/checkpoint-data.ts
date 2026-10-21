import "server-only";
import raw from "@/data/checkpoint-exams.json";
import chapter5Display from "@/data/chapter-5-checkpoint-display.json";
import chapter10Policy from "@/data/chapter-10-checkpoint-display.json";
import kanjiPages from "@/data/kanji.json";
import { buildChapter10Presentation, kanji1Characters } from "@/lib/chapter-10-checkpoint";
import type { CheckpointExam, CheckpointPresentation } from "@/types/checkpoint";
export const checkpointExams = raw as CheckpointExam[];
export function getCheckpointExam(id: string) {
  return checkpointExams.find(exam => exam.id === id);
}
export function getCheckpointPresentation(id: string): CheckpointPresentation | undefined {
  if (id === chapter5Display.examId) return chapter5Display;
  const exam = getCheckpointExam(id);
  return exam && Object.hasOwn(chapter10Policy.exams, id)
    ? buildChapter10Presentation(exam, chapter10Policy, kanji1Characters(kanjiPages[0])) : undefined;
}
