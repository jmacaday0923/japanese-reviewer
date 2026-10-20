import "server-only";
import raw from "@/data/listening-exams.json";
import type { ListeningExam } from "@/types/listening";
export const listeningExams = raw as ListeningExam[];
export const getListeningExam = (id: string) => listeningExams.find(exam => exam.id === id);
