export type CheckpointQuestion = {
  id: string; number: number; chapter: string; prompt: string;
  choices: { id: string; text: string }[]; correctChoiceId: string;
  explanationJa: string; explanationEn: string;
  source: { chapter: string; heading: string; title: string; evidence?: string };
  target?: string; context?: string;
  composition?: { before: string; after: string; orderedParts: string[]; starIndex: number };
  completedSentence?: string;
  passage?: { id: string; text: string; translationEn?: string };
};
export type CheckpointPart = {
  id: string; title: string; titleJa: string; instructionsJa: string;
  questions: CheckpointQuestion[];
};
export type CheckpointExam = {
  id: string; revision: number; title: string; description: string; parts: CheckpointPart[];
  focus?: string; cardDescription?: string;
  legacyAnchors?: Record<string, { partId: string; questionId: string }>;
};
