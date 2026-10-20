export type ListeningChoice = { id: string; text: string };
export type ListeningQuestion = {
  id: string; number: number; choices: ListeningChoice[]; correctChoiceId: string;
  image?: { src: string; alt: string; width: number; height: number };
  explanationJa: string; explanationEn: string; evidenceJa: string; evidenceStartSeconds: number;
};
export type ListeningSection = {
  id: string; number: number; title: string; titleJa: string; instructionsJa: string;
  audioSrc: string; audioDurationSeconds: number; questions: ListeningQuestion[];
};
export type ListeningExam = {
  id: string; revision: number; title: string; description: string; level: string;
  answerKeyNotice: string; sourceUrl: string; sections: ListeningSection[];
};
