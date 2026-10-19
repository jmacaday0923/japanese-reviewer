// Pure flashcard data, scheduling and persistence. No React, lesson data or browser globals.
export type Direction = "recognition" | "recall";
export type Rating = "again" | "hard" | "good" | "easy";
export const DIRECTIONS: readonly Direction[] = ["recognition", "recall"];
export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"];
export type FlashcardSource = { key: string; label: string; href: string };
export type FlashcardExample = { japanese: string; romaji: string; english: string; href: string };
export type FlashcardDraft = {
  kind: "vocabulary" | "kanji" | "sentence" | "kana";
  japanese: string; kana: string; romaji: string; meaning: string;
  source: FlashcardSource; example?: FlashcardExample;
};
export type ReviewState = {
  dueAt: number; intervalDays: number; reviews: number; lapses: number; lastReviewedAt: number | null;
};
export type SavedFlashcard = Omit<FlashcardDraft, "source" | "example"> & {
  id: string; sources: FlashcardSource[]; examples: FlashcardExample[];
  addedAt: number; progress: Record<Direction, ReviewState>;
};
export type FlashcardData = {
  version: 1; cards: SavedFlashcard[]; newLimit: number;
  daily: { day: string; recognition: string[]; recall: string[] };
};
export const FLASHCARD_KEY = "japanese-reviewer:flashcards";
export const MAX_CARDS = 5000;
export const DEFAULT_NEW_LIMIT = 20;
export const EMPTY_FLASHCARDS: FlashcardData = {
  version: 1, cards: [], newLimit: DEFAULT_NEW_LIMIT, daily: { day: "", recognition: [], recall: [] },
};
const initialReview = (): ReviewState => ({ dueAt: 0, intervalDays: 0, reviews: 0, lapses: 0, lastReviewedAt: null });
const normal = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
// A full content key avoids hash collisions and stays stable across page order changes.
export function flashcardId(card: Pick<FlashcardDraft, "kind" | "japanese" | "kana" | "romaji" | "meaning">): string {
  return JSON.stringify([card.kind, ...[card.japanese, card.kana, card.romaji, card.meaning].map(normal)]);
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const time = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8e15;
const integer = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
const text = (value: unknown, max = 3000): value is string => typeof value === "string" && value.length <= max;
function source(value: unknown): FlashcardSource | null {
  if (!record(value) || !text(value.href, 250) || !text(value.label, 200)) return null;
  const route = value.href.match(/^\/(chapters|kana|kanji)\/([A-Za-z0-9_-]{1,40})#([A-Za-z0-9_-]{1,100})$/);
  if (!route) return null;
  const key = (route[1] === "chapters" ? "chapter" : route[1]) + ":" + route[2];
  return value.key === key ? { key, label: value.label, href: value.href } : null;
}
function example(value: unknown): FlashcardExample | null {
  if (!record(value) || !text(value.japanese) || !value.japanese.trim() || !text(value.romaji) ||
      !text(value.english) || !value.english.trim() || !text(value.href, 250) ||
      !/^\/(chapters|kana|kanji)\/[A-Za-z0-9_-]{1,40}#[A-Za-z0-9_-]{1,100}$/.test(value.href)) return null;
  return { japanese: value.japanese, romaji: value.romaji, english: value.english, href: value.href };
}
function core(value: unknown): Pick<FlashcardDraft, "kind" | "japanese" | "kana" | "romaji" | "meaning"> | null {
  if (!record(value) || typeof value.kind !== "string" || !["vocabulary", "kanji", "sentence", "kana"].includes(value.kind) ||
      !text(value.japanese) || !value.japanese.trim() || !text(value.kana) || !text(value.romaji) ||
      !text(value.meaning) || !value.meaning.trim()) return null;
  return { kind: value.kind as FlashcardDraft["kind"], japanese: value.japanese, kana: value.kana, romaji: value.romaji, meaning: value.meaning };
}
function review(value: unknown): ReviewState | null {
  if (!record(value) || !time(value.dueAt) || !integer(value.intervalDays, 3650) ||
      !integer(value.reviews, 1_000_000) || !integer(value.lapses, value.reviews) ||
      !(value.lastReviewedAt === null || time(value.lastReviewedAt))) return null;
  return { dueAt: value.dueAt, intervalDays: value.intervalDays, reviews: value.reviews, lapses: value.lapses, lastReviewedAt: value.lastReviewedAt };
}
export function parseFlashcardData(raw: string | null): FlashcardData {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!record(value) || value.version !== 1) return EMPTY_FLASHCARDS;
    const cards: SavedFlashcard[] = [], seen = new Set<string>();
    for (const item of Array.isArray(value.cards) ? value.cards : []) {
      const fields = core(item);
      if (!fields || !record(item) || !time(item.addedAt) || !record(item.progress)) continue;
      const id = flashcardId(fields), recognition = review(item.progress.recognition), recall = review(item.progress.recall);
      const sources = (Array.isArray(item.sources) ? item.sources : []).map(source).filter((s): s is FlashcardSource => s !== null);
      if (item.id !== id || seen.has(id) || !recognition || !recall || sources.length === 0) continue;
      seen.add(id);
      cards.push({ ...fields, id, addedAt: item.addedAt, sources: sources.slice(0, 100),
        examples: (Array.isArray(item.examples) ? item.examples : []).map(example).filter((e): e is FlashcardExample => e !== null).slice(0, 3),
        progress: { recognition, recall } });
      if (cards.length === MAX_CARDS) break;
    }
    const daily = record(value.daily) ? value.daily : {};
    const ids = (items: unknown): string[] => [...new Set((Array.isArray(items) ? items : []).filter((id): id is string => text(id, 100000)))].slice(0, MAX_CARDS);
    return { version: 1, cards, newLimit: integer(value.newLimit, 200) ? value.newLimit : DEFAULT_NEW_LIMIT,
      daily: { day: typeof daily.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(daily.day) ? daily.day : "",
        recognition: ids(daily.recognition), recall: ids(daily.recall) } };
  } catch { return EMPTY_FLASHCARDS; }
}
export type BulkAddResult = { data: FlashcardData; added: number; existing: number; skipped: number };
// Merge the whole batch before the store serializes it: one write, shared identities and histories.
export function addFlashcards(data: FlashcardData, drafts: readonly FlashcardDraft[], now: number): BulkAddResult {
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  const original = new Set(cards.keys()), seen = new Set<string>();
  let changed = false, added = 0, existing = 0, skipped = 0;
  for (const draft of drafts) {
    const fields = core(draft), origin = source(draft.source);
    if (!fields || !origin || !time(now)) { skipped++; continue; }
    const id = flashcardId(fields), previous = cards.get(id), extra = example(draft.example);
    if (!seen.has(id)) {
      if (original.has(id)) existing++;
      else if (cards.size < MAX_CARDS) added++;
      else skipped++;
      seen.add(id);
    }
    if (previous) {
      const sources = previous.sources.length < 100 && !previous.sources.some((s) => s.href === origin.href)
        ? [...previous.sources, origin] : previous.sources;
      const examples = extra && previous.examples.length < 3 && !previous.examples.some((e) => e.href === extra.href && e.japanese === extra.japanese)
        ? [...previous.examples, extra] : previous.examples;
      if (sources !== previous.sources || examples !== previous.examples) {
        cards.set(id, { ...previous, sources, examples }); changed = true;
      }
    } else if (cards.size < MAX_CARDS) {
      cards.set(id, { ...fields, id, addedAt: now, sources: [origin], examples: extra ? [extra] : [],
        progress: { recognition: initialReview(), recall: initialReview() } });
      changed = true;
    }
  }
  return { data: changed ? { ...data, cards: [...cards.values()] } : data, added, existing, skipped };
}
export function addFlashcard(data: FlashcardData, draft: FlashcardDraft, now: number): FlashcardData {
  return addFlashcards(data, [draft], now).data;
}
export function bulkAddMessage(result: Omit<BulkAddResult, "data">): string {
  return result.added + " added · " + result.existing + " already saved" +
    (result.skipped ? " · " + result.skipped + " could not be added (deck full or invalid content)." : ".");
}
export type FlashcardDeckInfo = { key: string; slug: string; label: string; title: string; count: number };
export type FlashcardDeck = { version: 1; key: string; drafts: FlashcardDraft[] };
// Validate fetched decks atomically. A failed request or malformed deck imports nothing.
export function parseFlashcardDeck(value: unknown, key: string): FlashcardDraft[] {
  if (!record(value) || value.version !== 1 || value.key !== key || !Array.isArray(value.drafts) || value.drafts.length > 10000) throw new Error("Invalid flashcard deck");
  return value.drafts.map((item) => {
    const fields = core(item), origin = record(item) ? source(item.source) : null;
    if (!fields || !origin || origin.key !== key || !record(item)) throw new Error("Invalid flashcard row");
    const extra = example(item.example);
    if (item.example !== undefined && !extra) throw new Error("Invalid flashcard example");
    return { ...fields, source: origin, ...(extra ? { example: extra } : {}) };
  });
}
// Seeded Fisher–Yates: create a fresh seed on a user action, never while rendering a card.
export function shuffledFlashcardIds(cards: readonly SavedFlashcard[], seed: number): string[] {
  const ids = cards.map((card) => card.id);
  let state = seed >>> 0;
  for (let i = ids.length - 1; i > 0; i--) {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    const j = Math.floor((((value ^ (value >>> 14)) >>> 0) / 4294967296) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
export function removeFlashcard(data: FlashcardData, id: string): FlashcardData {
  return data.cards.some((card) => card.id === id) ? { ...data, cards: data.cards.filter((card) => card.id !== id) } : data;
}
export function restoreFlashcard(data: FlashcardData, card: SavedFlashcard): FlashcardData {
  return data.cards.some((item) => item.id === card.id) || data.cards.length >= MAX_CARDS ? data : { ...data, cards: [...data.cards, card] };
}
export function setNewLimit(data: FlashcardData, limit: number): FlashcardData {
  return integer(limit, 200) && limit !== data.newLimit ? { ...data, newLimit: limit } : data;
}
export function localDay(now: number): string {
  const date = new Date(now);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
// A transparent calendar-day scheduler, not FSRS or a claim of optimal intervals.
export function scheduleReview(previous: ReviewState, rating: Rating, now: number): ReviewState {
  const learningMinutes = rating === "again" ? 10 : rating === "hard" && previous.intervalDays === 0 ? 30 : 0;
  const days = learningMinutes ? 0 : rating === "hard" ? Math.max(1, Math.ceil(previous.intervalDays * 1.2))
    : rating === "good" ? Math.max(1, previous.intervalDays + 1, Math.ceil(previous.intervalDays * 2.5))
    : Math.max(4, previous.intervalDays + 1, Math.ceil(previous.intervalDays * 3.2));
  const intervalDays = Math.min(3650, days), date = new Date(now);
  date.setDate(date.getDate() + intervalDays);
  date.setHours(0, 0, 0, 0); // Scheduled day reviews are available from local midnight.
  return { dueAt: learningMinutes ? now + learningMinutes * 60_000 : date.getTime(), intervalDays,
    reviews: previous.reviews + 1, lapses: previous.lapses + (rating === "again" ? 1 : 0), lastReviewedAt: now };
}
export function reviewFlashcard(data: FlashcardData, id: string, direction: Direction, rating: Rating, now: number, expectedReviews: number): FlashcardData {
  const card = data.cards.find((item) => item.id === id);
  if (!card || !DIRECTIONS.includes(direction) || !RATINGS.includes(rating) || !time(now)) return data;
  const previous = card.progress[direction];
  if (previous.reviews !== expectedReviews || previous.reviews >= 1_000_000 || (previous.reviews > 0 && previous.dueAt > now)) return data;
  const day = localDay(now), daily = data.daily.day === day ? data.daily : { day, recognition: [], recall: [] };
  const introduced = daily[direction].includes(id);
  if (previous.reviews === 0 && !introduced && daily[direction].length >= data.newLimit) return data;
  const progress = { ...card.progress, [direction]: scheduleReview(previous, rating, now) };
  return { ...data, cards: data.cards.map((item) => item.id === id ? { ...item, progress } : item),
    daily: previous.reviews === 0 && !introduced ? { ...daily, [direction]: [...daily[direction], id] } : daily };
}
export function inSources(card: SavedFlashcard, selected: readonly string[]): boolean {
  return selected.length === 0 || card.sources.some((source) => selected.includes(source.key));
}
export function reviewQueue(data: FlashcardData, direction: Direction, selected: readonly string[], now: number, order?: readonly string[]) {
  const ranks = order ? new Map(order.map((id, rank) => [id, rank])) : null;
  const randomOrder = (a: SavedFlashcard, b: SavedFlashcard) => (ranks?.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (ranks?.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  const filtered = data.cards.filter((card) => inSources(card, selected));
  const introduced = data.daily.day === localDay(now) ? data.daily[direction] : [];
  const remaining = Math.max(0, data.newLimit - introduced.length);
  const due = filtered.filter((card) => card.progress[direction].reviews > 0 && card.progress[direction].dueAt <= now)
    .sort((a, b) => randomOrder(a, b) || a.progress[direction].dueAt - b.progress[direction].dueAt || a.addedAt - b.addedAt);
  const fresh = filtered.filter((card) => card.progress[direction].reviews === 0)
    .sort((a, b) => randomOrder(a, b) || a.addedAt - b.addedAt);
  // A removed then re-added card cannot bypass today's allowance or be stranded by it.
  const newCards = [...fresh.filter((card) => introduced.includes(card.id)), ...fresh.filter((card) => !introduced.includes(card.id)).slice(0, remaining)];
  const future = filtered.map((card) => card.progress[direction]).filter((state) => state.reviews > 0 && state.dueAt > now);
  return { cards: [...due, ...newCards], dueCount: due.length, newCount: newCards.length, introducedToday: introduced.length,
    remaining, totalCount: filtered.length, nextDueAt: future.length ? Math.min(...future.map((state) => state.dueAt)) : null };
}
export function sourceOptions(cards: readonly SavedFlashcard[]): FlashcardSource[] {
  const byKey = new Map<string, FlashcardSource>();
  for (const card of cards) for (const origin of card.sources) if (!byKey.has(origin.key)) byKey.set(origin.key, origin);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }));
}
export function performance(cards: readonly SavedFlashcard[], direction: Direction) {
  const reviews = cards.reduce((sum, card) => sum + card.progress[direction].reviews, 0);
  const again = cards.reduce((sum, card) => sum + card.progress[direction].lapses, 0);
  return { reviews, again, remembered: reviews - again, percent: reviews ? Math.round((reviews - again) * 100 / reviews) : 0 };
}
export type FlashcardSnapshot = { ready: boolean; saved: boolean; data: FlashcardData };
export const FLASHCARD_SERVER_SNAPSHOT: FlashcardSnapshot = { ready: false, saved: true, data: EMPTY_FLASHCARDS };
export function createFlashcardStore(options: { getStorage: () => Pick<Storage, "getItem" | "setItem">; getEvents?: () => EventTarget }) {
  let initialized = false, storage: Pick<Storage, "getItem" | "setItem"> | null = null;
  let memory: string | null = null, previousRaw: string | null | undefined, snapshot: FlashcardSnapshot | undefined;
  const listeners = new Set<() => void>();
  function getSnapshot(): FlashcardSnapshot {
    if (!initialized) { initialized = true; try { storage = options.getStorage(); } catch { storage = null; } }
    if (storage) { try { memory = storage.getItem(FLASHCARD_KEY); } catch { storage = null; } }
    const saved = storage !== null;
    if (!snapshot || memory !== previousRaw || saved !== snapshot.saved) {
      previousRaw = memory;
      snapshot = { ready: true, saved, data: parseFlashcardData(memory) };
    }
    return snapshot;
  }
  function update(change: (data: FlashcardData) => FlashcardData): boolean {
    const current = getSnapshot(), next = change(current.data);
    if (next === current.data) return false;
    memory = JSON.stringify(next);
    if (storage) { try { storage.setItem(FLASHCARD_KEY, memory); } catch { storage = null; } }
    previousRaw = memory;
    snapshot = { ready: true, saved: storage !== null, data: next };
    for (const listener of listeners) listener();
    return true;
  }
  function subscribe(listener: () => void) {
    listeners.add(listener);
    const events = options.getEvents?.();
    function changed(event: Event) { const key = (event as StorageEvent).key; if (key === null || key === FLASHCARD_KEY) listener(); }
    events?.addEventListener("storage", changed);
    return () => { listeners.delete(listener); events?.removeEventListener("storage", changed); };
  }
  return { getSnapshot, update, subscribe };
}
