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

// Presentation only: it never changes question IDs, keys or saved attempts.
export type CheckpointPresentation = {
  examId: string;
  instructionsEn: Record<string, string>;
  kana: Record<string, string>;
  readings: Record<string, string>;
  prepared?: {
    titles: Record<string, CheckpointTextPart[]>;
    instructions: Record<string, CheckpointTextPart[]>;
    questions: Record<string, CheckpointQuestionText>;
  };
};

export type CheckpointTextPart = { text: string; reading?: string };
export type CheckpointQuestionText = {
  prompt: CheckpointTextPart[];
  context?: CheckpointTextPart[];
  passage?: CheckpointTextPart[];
  composition?: { before: CheckpointTextPart[]; after: CheckpointTextPart[] };
  choices: Record<string, CheckpointTextPart[]>;
  answer: CheckpointTextPart[];
  completedSentence?: CheckpointTextPart[];
  explanationJa: CheckpointTextPart[];
  explanationEn: CheckpointTextPart[];
};
export type Chapter10CheckpointPolicy = {
  lexicon: Record<string, CheckpointTextPart[]>;
  exams: Record<string, { instructionsEn: Record<string, string>; protectChoiceReadings: string[] }>;
};
