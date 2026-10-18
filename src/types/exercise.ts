// The interactive exercise bank (src/data/exercises.json). Every question is
// copied from an exercise table in chapters.json and its row in the Answer
// key, and records where it came from, so the bank can be checked against
// the original (tests/exercises.test.mjs does this for every question).

// Where a question came from: the exercise part's heading id, the matching
// answer key part's heading id, and the question number. Numbers repeat in
// every part, so all three together identify one question.
export type ExerciseSource = {
  exercise: string;  // "c1-part-a-fill-in-the-marker-wa-no-to-ka-or"
  answerKey: string; // "c1-part-a-fill-in-the-marker-wa-no-to-ka-or-2"
  number: number;    // the # column in both tables
};

// Fill in the particle: "watashi ____ kenshuusei desu."
export type ParticleQuestion = {
  id: string;         // stable: "c1-particles-1"
  prompt: string;     // the Question cell, word for word, with ____ for the blank
  answer: string;     // the Answer cell, word for word: "wa (は)"
  accepted: string[]; // every answer that counts as correct, already normalized
  why: string;        // the Why cell, word for word
  source: ExerciseSource;
};

// One Japanese word and its English meaning, from a vocabulary check.
// "What does X mean?" gives the Japanese in the question and the English in
// the answer; "Say "Y" in Japanese." is the other way round.
export type VocabularyPair = {
  id: string;           // stable: "c1-vocabulary-1"
  question: string;     // the Question cell, word for word
  answer: string;       // the Answer cell, word for word
  japanese: string;     // romaji, as the source writes it
  kana: string | null;  // only when the answer key gives it
  english: string;      // the meaning, as the source writes it
  why: string;          // the Why cell, word for word
  source: ExerciseSource;
};

export type ParticleSet = {
  id: string;           // "c1-particles"
  type: "particles";
  title: string;        // the exercise part's heading
  questions: ParticleQuestion[];
};

export type VocabularySet = {
  id: string;           // "c1-vocabulary"
  type: "vocabulary";
  title: string;
  pairs: VocabularyPair[];
};

export type ExerciseSet = ParticleSet | VocabularySet;

// Everything for one chapter. Only the chapter being read is sent to the browser.
export type ChapterExercises = {
  chapter: string; // matches Chapter.ch in chapters.json
  sets: ExerciseSet[];
};

export type ExerciseBank = { version: 1; chapters: ChapterExercises[] };
