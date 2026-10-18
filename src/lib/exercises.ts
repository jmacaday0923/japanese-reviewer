// Grading and practice progress for the interactive exercises. Plain
// functions and types only (no React, no data imports), so the Node tests
// can run them directly and the browser gets only this small module.
import type { ParticleQuestion, VocabularyPair } from "@/types/exercise";

// ---- Answers ----

// Conservative clean-up before comparing: NFKC (full-width "ｗａ" becomes
// "wa", half-width kana become full-width), trimmed, runs of spaces made
// one space, Latin letters lower-cased. Nothing else: "わ" stays "わ", so it
// only counts where a question lists it.
export function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export type Grade = "blank" | "correct" | "incorrect";

// Correct only when the cleaned-up answer is one of the question's accepted
// answers. Blank answers aren't graded.
export function gradeParticle(question: Pick<ParticleQuestion, "accepted">, value: string): Grade {
  const answer = normalizeAnswer(value);
  if (answer === "") return "blank";
  return question.accepted.some((a) => normalizeAnswer(a) === answer) ? "correct" : "incorrect";
}

// A match is right when the chosen meaning belongs to the same pair, by id.
// The English text is never compared, so two pairs with similar wording
// can't be confused.
export function gradePair(pair: Pick<VocabularyPair, "id">, chosenPairId: string): Grade {
  if (chosenPairId === "") return "blank";
  return chosenPairId === pair.id ? "correct" : "incorrect";
}

// ---- Progress through one activity ----

export type Status = "unanswered" | "correct" | "incorrect";

export type QuestionProgress = {
  value: string;                       // what's typed or chosen now
  status: Status;                      // its current grade; unanswered until checked
  first: "correct" | "incorrect" | null; // its very first grade, kept through retries
};

export type ActivityState = {
  attempt: number;    // goes up on Restart; seeds the vocabulary shuffle
  retryRound: number; // 0 on the first try, 1 after the first Retry incorrect, ...
  ids: string[];      // question order
  progress: Record<string, QuestionProgress>;
};

const EMPTY: QuestionProgress = { value: "", status: "unanswered", first: null };

export function createActivity(ids: readonly string[], attempt = 0): ActivityState {
  return {
    attempt,
    retryRound: 0,
    ids: [...ids],
    progress: Object.fromEntries(ids.map((id) => [id, EMPTY])),
  };
}

// Typing or choosing. A correct answer is kept as it is. Changing an
// incorrect answer removes its old grade until it's checked again (its
// first grade stays, so the original score doesn't change).
export function editAnswer(state: ActivityState, id: string, value: string): ActivityState {
  const current = state.progress[id];
  if (!current || current.status === "correct" || current.value === value) return state;
  return { ...state, progress: { ...state.progress, [id]: { ...current, value, status: "unanswered" } } };
}

// Records grades for some questions. Blank grades are left out: those
// questions stay unanswered. A correct answer is never graded again.
export function applyGrades(state: ActivityState, grades: Record<string, Grade>): ActivityState {
  const progress = { ...state.progress };
  let changed = false;
  for (const [id, grade] of Object.entries(grades)) {
    const current = progress[id];
    if (!current || grade === "blank" || current.status === "correct") continue;
    progress[id] = { ...current, status: grade, first: current.first ?? grade };
    changed = true;
  }
  return changed ? { ...state, progress } : state;
}

// Clears only the incorrect answers for another go. Correct answers and
// every first grade stay as they are.
export function retryIncorrect(state: ActivityState): ActivityState {
  const wrong = incorrectIds(state);
  if (wrong.length === 0) return state;
  const progress = { ...state.progress };
  for (const id of wrong) progress[id] = { ...progress[id], value: "", status: "unanswered" };
  return { ...state, retryRound: state.retryRound + 1, progress };
}

// Back to the start, with a new attempt number (a new shuffle)
export function restartActivity(state: ActivityState): ActivityState {
  return createActivity(state.ids, state.attempt + 1);
}

export function incorrectIds(state: ActivityState): string[] {
  return state.ids.filter((id) => state.progress[id].status === "incorrect");
}

export type ActivitySummary = {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  checked: boolean;   // every question has a grade
  complete: boolean;  // every question is correct
  canRetry: boolean;  // checked, with at least one incorrect
  retryRound: number;
  // The first try's score, once every question has been graded at least once
  firstTry: { correct: number; total: number } | null;
};

export function summarize(state: ActivityState): ActivitySummary {
  const all = state.ids.map((id) => state.progress[id]);
  const count = (status: Status) => all.filter((q) => q.status === status).length;
  const correct = count("correct");
  const incorrect = count("incorrect");
  const unanswered = count("unanswered");
  const checked = unanswered === 0;
  return {
    total: all.length,
    correct,
    incorrect,
    unanswered,
    checked,
    complete: correct === all.length,
    canRetry: checked && incorrect > 0,
    retryRound: state.retryRound,
    firstTry: all.every((q) => q.first !== null)
      ? { correct: all.filter((q) => q.first === "correct").length, total: all.length }
      : null,
  };
}

// ---- Vocabulary rounds and a stable shuffle ----

export const ROUND_SIZE = 5;

// Pairs in groups of five, in source order
export function vocabularyRounds<T>(pairs: readonly T[], size = ROUND_SIZE): T[][] {
  const rounds: T[][] = [];
  for (let i = 0; i < pairs.length; i += size) rounds.push(pairs.slice(i, i + size));
  return rounds;
}

// Same seed, same order, on the server and in the browser, so the first
// render matches. The order never equals the original (it would line every
// meaning up with its word), unless there's only one item.
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  const random = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((item, i) => item === items[i])) out.push(out.shift()!);
  return out;
}
