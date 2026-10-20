import "server-only";
import raw from "@/data/checkpoint-exams.json";
import type { CheckpointExam } from "@/types/checkpoint";
export const checkpointExams = raw as CheckpointExam[];
export function getCheckpointExam(id: string) {
  return checkpointExams.find(exam => exam.id === id);
}
