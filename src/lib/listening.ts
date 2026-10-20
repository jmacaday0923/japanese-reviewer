import type { ListeningExam } from "@/types/listening";

export type ListeningScore = { correct: number; total: number; unanswered: number };
export type ListeningAttempt = {
  version: 1; examId: string; examRevision: number; sectionId: string;
  answers: Record<string, string>; submitted: boolean; locked: string[];
  firstScore: ListeningScore | null; retryRound: number; attempt: number;
};
export const listeningKey = (exam: ListeningExam) => `japanese-reviewer:listening:${exam.id}:v${exam.revision}`;
export const listeningQuestions = (exam: ListeningExam) => exam.sections.flatMap(section => section.questions);
export function newListeningAttempt(exam: ListeningExam, attempt = 0): ListeningAttempt {
  return { version: 1, examId: exam.id, examRevision: exam.revision, sectionId: exam.sections[0].id,
    answers: {}, submitted: false, locked: [], firstScore: null, retryRound: 0, attempt };
}
export function listeningScore(exam: ListeningExam, state: ListeningAttempt): ListeningScore {
  const questions = listeningQuestions(exam);
  return { total: questions.length, correct: questions.filter(q => state.answers[q.id] === q.correctChoiceId).length,
    unanswered: questions.filter(q => !state.answers[q.id]).length };
}
export function chooseListeningAnswer(exam: ListeningExam, state: ListeningAttempt, id: string, choice: string): ListeningAttempt {
  const question = listeningQuestions(exam).find(q => q.id === id);
  if (state.submitted || state.locked.includes(id) || !question?.choices.some(option => option.id === choice)) return state;
  return { ...state, answers: { ...state.answers, [id]: choice } };
}
export function selectListeningSection(exam: ListeningExam, state: ListeningAttempt, id: string): ListeningAttempt {
  return exam.sections.some(section => section.id === id) && id !== state.sectionId ? { ...state, sectionId: id } : state;
}
export function submitListeningAttempt(exam: ListeningExam, state: ListeningAttempt): ListeningAttempt {
  return state.submitted ? state : { ...state, submitted: true, firstScore: state.firstScore ?? listeningScore(exam, state) };
}
export function retryListeningIncorrect(exam: ListeningExam, state: ListeningAttempt): ListeningAttempt {
  if (!state.submitted || listeningScore(exam, state).correct === listeningQuestions(exam).length) return state;
  const questions = listeningQuestions(exam);
  const locked = questions.filter(q => state.answers[q.id] === q.correctChoiceId).map(q => q.id);
  const wrong = questions.find(q => !locked.includes(q.id))!;
  return { ...state, submitted: false, locked, retryRound: state.retryRound + 1,
    answers: Object.fromEntries(locked.map(id => [id, state.answers[id]])),
    sectionId: exam.sections.find(section => section.questions.some(q => q.id === wrong.id))!.id };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function parseListeningAttempt(exam: ListeningExam, raw: string | null): ListeningAttempt {
  const fresh = newListeningAttempt(exam);
  if (!raw || raw.length > 100_000) return fresh;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || value.examId !== exam.id || value.examRevision !== exam.revision ||
      !exam.sections.some(s => s.id === value.sectionId) || !record(value.answers) || typeof value.submitted !== "boolean" ||
      !Array.isArray(value.locked) || !integer(value.retryRound) || !integer(value.attempt)) return fresh;
    const questions = listeningQuestions(exam);
    const answers: Record<string, string> = {};
    for (const [id, choice] of Object.entries(value.answers)) {
      const question = questions.find(q => q.id === id);
      if (typeof choice !== "string" || !question?.choices.some(c => c.id === choice)) return fresh;
      answers[id] = choice;
    }
    if (new Set(value.locked).size !== value.locked.length || value.locked.some(id => typeof id !== "string" ||
      !questions.some(q => q.id === id && q.correctChoiceId === answers[id]))) return fresh;
    let firstScore: ListeningScore | null = null;
    if (value.firstScore !== null) {
      const score = value.firstScore;
      if (!record(score) || !integer(score.correct) || score.total !== questions.length || !integer(score.unanswered) ||
        score.correct + score.unanswered > questions.length) return fresh;
      firstScore = { correct: score.correct, total: questions.length, unanswered: score.unanswered };
    }
    if ((value.submitted || value.retryRound > 0 || value.locked.length > 0) && !firstScore) return fresh;
    return { version: 1, examId: exam.id, examRevision: exam.revision, sectionId: value.sectionId as string,
      answers, submitted: value.submitted, locked: value.locked as string[], firstScore,
      retryRound: value.retryRound, attempt: value.attempt };
  } catch { return fresh; }
}

// Each exam has its own browser store. Reading from storage is deferred until subscription.
export function createListeningStore(exam: ListeningExam, options: { getStorage: () => Pick<Storage, "getItem" | "setItem">; getEvents?: () => EventTarget }) {
  const server = { ready: false, saved: true, state: newListeningAttempt(exam) };
  let snapshot = server;
  let events: EventTarget | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function load() {
    try { snapshot = { ready: true, saved: true, state: parseListeningAttempt(exam, options.getStorage().getItem(listeningKey(exam))) }; }
    catch { snapshot = { ...snapshot, ready: true, saved: false }; }
  }
  function onStorage(event: Event) {
    const key = (event as StorageEvent).key;
    if (key === listeningKey(exam) || key === null) { load(); emit(); }
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        if (!snapshot.ready) load();
        try { events = options.getEvents?.(); events?.addEventListener("storage", onStorage); } catch { events = undefined; }
      }
      listeners.add(listener);
      return () => { listeners.delete(listener); if (!listeners.size) { events?.removeEventListener("storage", onStorage); events = undefined; } };
    },
    update(change: (state: ListeningAttempt) => ListeningAttempt) {
      if (!snapshot.ready) load();
      const next = change(snapshot.state);
      if (next === snapshot.state) return;
      let saved = true;
      try { options.getStorage().setItem(listeningKey(exam), JSON.stringify(next)); } catch { saved = false; }
      snapshot = { ready: true, saved, state: next }; emit();
    },
  };
}
