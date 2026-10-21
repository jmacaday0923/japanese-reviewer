import "server-only";
import raw from "@/data/checkpoint-exams.json";
import chapter5Display from "@/data/chapter-5-checkpoint-display.json";
import type { CheckpointExam, CheckpointPresentation } from "@/types/checkpoint";
export const checkpointExams = raw as CheckpointExam[];
export function getCheckpointExam(id: string) {
  return checkpointExams.find(exam => exam.id === id);
}
export function getCheckpointPresentation(id: string): CheckpointPresentation | undefined {
  return id === chapter5Display.examId ? chapter5Display : undefined;
}
