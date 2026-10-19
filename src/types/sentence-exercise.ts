import type { StudyDisplay } from "@/lib/study-markup";
export type SentenceSource = {
  heading: string;
  table: number; // One-based table and row within this lesson heading.
  row: number;
  variant?: number; // Zero-based slash-separated example, when the source pairs two forms.
};
export type SentenceExample = {
  japanese: string;
  romaji: string;
  english: string;
  source: SentenceSource;
};
export type WordOrderQuestion = {
  id: string;
  type: "order";
  example: SentenceExample;
  tokens: string[]; // Words or phrases; repeated text is allowed.
  displayWhy?: StudyDisplay;
  why: string;
  whyParagraph: number; // One-based explanatory paragraph under the answer/source heading.
};
export type TransformationQuestion = {
  id: string;
  type: "transform";
  change: "negative" | "casual";
  original: SentenceExample;
  answer: SentenceExample;
  displayWhy?: StudyDisplay;
  why: string;
  whyParagraph: number; // One-based explanatory paragraph under the answer/source heading.
};
export type SentenceQuestion = WordOrderQuestion | TransformationQuestion;
export type ChapterSentenceExercises = {
  chapter: string;
  order: WordOrderQuestion[];
  transformations: TransformationQuestion[];
};
export type SentenceExerciseBank = { version: 1; chapters: ChapterSentenceExercises[] };
