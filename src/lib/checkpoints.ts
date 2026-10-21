import type { CheckpointExam, CheckpointQuestion } from "@/types/checkpoint";

export type CheckpointScore = { correct: number; total: number; unanswered: number };
export type CheckpointHistory = CheckpointScore & { attempt: number; completedAt: string };
export type CheckpointAttempt = {
  version: 1; examId: string; examRevision: number; partId: string;
  answers: Record<string, string>; submitted: boolean; locked: string[];
  firstAnswers: Record<string, string> | null; retryRound: number; attempt: number;
  history: CheckpointHistory[];
};
export const checkpointKey = (exam: CheckpointExam) => "japanese-reviewer:checkpoint:" + exam.id + ":v" + exam.revision;
export const checkpointQuestions = (exam: CheckpointExam) => exam.parts.flatMap(part => part.questions);
export function questionScore(questions: CheckpointQuestion[], answers: Record<string, string>): CheckpointScore {
  return { total: questions.length, correct: questions.filter(q => answers[q.id] === q.correctChoiceId).length,
    unanswered: questions.filter(q => !answers[q.id]).length };
}
export const checkpointScore = (exam: CheckpointExam, answers: Record<string, string>) => questionScore(checkpointQuestions(exam), answers);
export function checkpointByChapter(exam: CheckpointExam, answers: Record<string, string>) {
  const questions = checkpointQuestions(exam);
  return [...new Set(questions.map(q => q.chapter))].sort((a, b) => Number(a) - Number(b)).map(chapter => {
    return { chapter, ...questionScore(questions.filter(q => q.chapter === chapter), answers) };
  });
}
// Derive coverage from the bank, so smaller checkpoints never show empty chapters.
export function checkpointCoverage(exam: CheckpointExam) {
  const chapters = checkpointByChapter(exam, {}).map(s => s.chapter);
  return { afterChapter: chapters.at(-1)!, label: chapters.length === 1 ? "Chapter " + chapters[0] : "Chapters " + chapters[0] + "–" + chapters.at(-1) };
}
export function checkpointAnchor(exam: CheckpointExam, hash: string) {
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { return null; }
  const alias = exam.legacyAnchors?.[id];
  const part = exam.parts.find(p => p.questions.some(q => q.id === (alias?.questionId ?? id)));
  return part ? { partId: part.id, questionId: alias?.questionId ?? id, anchor: id } : null;
}
export function newCheckpointAttempt(exam: CheckpointExam, previous?: CheckpointAttempt): CheckpointAttempt {
  return { version: 1, examId: exam.id, examRevision: exam.revision, partId: exam.parts[0].id,
    answers: {}, submitted: false, locked: [], firstAnswers: null, retryRound: 0,
    attempt: previous ? previous.attempt + 1 : 1, history: previous?.history ?? [] };
}
export function chooseCheckpointAnswer(exam: CheckpointExam, state: CheckpointAttempt, id: string, answer: string): CheckpointAttempt {
  if (state.submitted || state.locked.includes(id) ||
    !checkpointQuestions(exam).find(q => q.id === id)?.choices.some(c => c.id === answer)) return state;
  return { ...state, answers: { ...state.answers, [id]: answer } };
}
export function selectCheckpointPart(exam: CheckpointExam, state: CheckpointAttempt, id: string): CheckpointAttempt {
  return exam.parts.some(p => p.id === id) && id !== state.partId ? { ...state, partId: id } : state;
}
export function submitCheckpointAttempt(exam: CheckpointExam, state: CheckpointAttempt, completedAt: string): CheckpointAttempt {
  if (state.submitted) return state;
  const first = state.firstAnswers === null;
  return { ...state, submitted: true, firstAnswers: state.firstAnswers ?? { ...state.answers },
    history: first ? [...state.history, { attempt: state.attempt, completedAt, ...checkpointScore(exam, state.answers) }].slice(-10) : state.history };
}
export function retryCheckpointIncorrect(exam: CheckpointExam, state: CheckpointAttempt): CheckpointAttempt {
  const questions = checkpointQuestions(exam);
  if (!state.submitted || checkpointScore(exam, state.answers).correct === questions.length) return state;
  const locked = questions.filter(q => state.answers[q.id] === q.correctChoiceId).map(q => q.id);
  const firstWrong = questions.find(q => !locked.includes(q.id))!;
  return { ...state, answers: Object.fromEntries(locked.map(id => [id, state.answers[id]])), locked,
    submitted: false, retryRound: state.retryRound + 1,
    partId: exam.parts.find(p => p.questions.some(q => q.id === firstWrong.id))!.id };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const integer = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
function parseAnswers(exam: CheckpointExam, raw: unknown): Record<string, string> | null {
  if (!record(raw)) return null;
  const questions = checkpointQuestions(exam);
  if (Object.entries(raw).some(([id, answer]) => typeof answer !== "string" || !questions.find(q => q.id === id)?.choices.some(c => c.id === answer))) return null;
  return Object.fromEntries(Object.entries(raw)) as Record<string, string>;
}
export function parseCheckpointAttempt(exam: CheckpointExam, raw: string | null): CheckpointAttempt {
  const fresh = newCheckpointAttempt(exam);
  if (!raw || raw.length > 100_000) return fresh;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || value.examId !== exam.id || value.examRevision !== exam.revision ||
      !exam.parts.some(p => p.id === value.partId) || typeof value.submitted !== "boolean" || !integer(value.retryRound) ||
      !integer(value.attempt) || value.attempt < 1 || !Array.isArray(value.locked) || !Array.isArray(value.history)) return fresh;
    const answers = parseAnswers(exam, value.answers);
    const firstAnswers = value.firstAnswers === null ? null : parseAnswers(exam, value.firstAnswers);
    if (!answers || (value.firstAnswers !== null && !firstAnswers)) return fresh;
    if ((value.submitted || value.retryRound > 0 || value.locked.length > 0) && firstAnswers === null) return fresh;
    if (value.retryRound === 0 && value.locked.length > 0) return fresh;
    const questions = checkpointQuestions(exam);
    if (new Set(value.locked).size !== value.locked.length || value.locked.some(id => typeof id !== "string" ||
      !questions.some(q => q.id === id && q.correctChoiceId === answers[id]))) return fresh;
    const attempt = value.attempt;
    if (value.history.length > 10 || value.history.some(h => !record(h) || !integer(h.attempt) || h.attempt < 1 || h.attempt > attempt ||
      typeof h.completedAt !== "string" || !Number.isFinite(Date.parse(h.completedAt)) ||
      !integer(h.correct) || h.total !== questions.length || !integer(h.unanswered) || h.correct + h.unanswered > questions.length)) return fresh;
    const history = value.history as CheckpointHistory[];
    if (new Set(history.map(h => h.attempt)).size !== history.length || history.some((h, i) => i > 0 && h.attempt <= history[i - 1].attempt)) return fresh;
    const current = history.find(h => h.attempt === value.attempt);
    if (firstAnswers) {
      const firstScore = checkpointScore(exam, firstAnswers);
      if (!current || current.correct !== firstScore.correct || current.unanswered !== firstScore.unanswered) return fresh;
    } else if (current) return fresh;
    return { version: 1, examId: exam.id, examRevision: exam.revision, partId: value.partId as string, answers,
      firstAnswers, submitted: value.submitted, locked: value.locked as string[],
      retryRound: value.retryRound, attempt: value.attempt, history };
  } catch { return fresh; }
}
export function createCheckpointStore(exam: CheckpointExam, options: {
  getStorage: () => Pick<Storage, "getItem" | "setItem">; getEvents?: () => EventTarget;
}) {
  const server = { ready: false, saved: true, state: newCheckpointAttempt(exam) };
  let snapshot = server;
  let events: EventTarget | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  function load() {
    try { snapshot = { ready: true, saved: true, state: parseCheckpointAttempt(exam, options.getStorage().getItem(checkpointKey(exam))) }; }
    catch { snapshot = { ...snapshot, ready: true, saved: false }; }
  }
  function onStorage(event: Event) {
    const key = (event as StorageEvent).key;
    if (key === checkpointKey(exam) || key === null) { load(); emit(); }
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      if (!listeners.size) {
        if (!snapshot.ready || snapshot.saved) load();
        try { events = options.getEvents?.(); events?.addEventListener("storage", onStorage); } catch { events = undefined; }
      }
      listeners.add(listener);
      return () => { listeners.delete(listener); if (!listeners.size) { events?.removeEventListener("storage", onStorage); events = undefined; } };
    },
    update(change: (state: CheckpointAttempt) => CheckpointAttempt) {
      if (!snapshot.ready) load();
      const next = change(snapshot.state);
      if (next === snapshot.state) return;
      let saved = true;
      try { options.getStorage().setItem(checkpointKey(exam), JSON.stringify(next)); } catch { saved = false; }
      snapshot = { ready: true, saved, state: next }; emit();
    },
  };
}
