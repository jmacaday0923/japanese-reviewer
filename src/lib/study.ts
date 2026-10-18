// Bookmarks and the last study page you opened, saved in this browser's
// localStorage. Plain functions and a small store with no React or data
// imports, so the Node tests can run them directly.
//
// Saved format (one JSON value under STORAGE_KEY):
//   { "version": 1,
//     "bookmarks": [{ "kind": "chapter", "id": "3", "anchor": "vocab", "section": "Vocabulary", "savedAt": 1760000000000 }],
//     "lastVisit": { "kind": "lesson", "id": "1", "anchor": null, "section": null, "visitedAt": 1760000000000 } }
// Anything that doesn't fit is dropped when it's read, never trusted.

export type StudyPageKind = "chapter" | "kana" | "kanji" | "lesson";

// A study page, and optionally one section on it
export type StudyPlace = {
  kind: StudyPageKind;
  id: string;             // the route value: "3" for /chapters/3
  anchor: string | null;  // an existing heading id on that page, or null for the whole page
  section: string | null; // that section's label when it was saved, like "Vocabulary"
};

export type Bookmark = StudyPlace & { savedAt: number };
export type LastVisit = StudyPlace & { visitedAt: number };

export type StudyDataV1 = {
  version: 1;
  bookmarks: Bookmark[]; // newest first
  lastVisit: LastVisit | null;
};
export type StudyData = StudyDataV1; // the current version

export const STORAGE_KEY = "japanese-reviewer:study";
export const MAX_BOOKMARKS = 100;
export const EMPTY_DATA: StudyData = { version: 1, bookmarks: [], lastVisit: null };

const BASE_PATHS: Record<StudyPageKind, string> = {
  chapter: "/chapters",
  kana: "/kana",
  kanji: "/kanji",
  lesson: "/lessons",
};

type Target = Pick<StudyPlace, "kind" | "id" | "anchor">;

export function studyHref({ kind, id, anchor }: Target) {
  return `${BASE_PATHS[kind]}/${id}${anchor ? `#${anchor}` : ""}`;
}

// "chapter:3", to match a saved place with the pages that exist
export function pageKey({ kind, id }: Pick<StudyPlace, "kind" | "id">) {
  return `${kind}:${id}`;
}

function sameTarget(a: Target, b: Target) {
  return a.kind === b.kind && a.id === b.id && a.anchor === b.anchor;
}

// ---- Reading saved data ----

// Route values and anchor ids in the data are all letters, digits, - and _
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const ANCHOR = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_LABEL = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPlace(value: Record<string, unknown>): StudyPlace | null {
  const { kind, id, anchor, section } = value;
  if (typeof kind !== "string" || !Object.hasOwn(BASE_PATHS, kind)) return null;
  if (typeof id !== "string" || !ID.test(id)) return null;
  if (anchor !== null && (typeof anchor !== "string" || !ANCHOR.test(anchor))) return null;
  const label = anchor !== null && typeof section === "string" && section.trim() ? section.trim().slice(0, MAX_LABEL) : null;
  return { kind: kind as StudyPageKind, id, anchor, section: label };
}

function readTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function readBookmark(value: unknown): Bookmark | null {
  if (!isRecord(value)) return null;
  const place = readPlace(value);
  const savedAt = readTime(value.savedAt);
  return place && savedAt !== null ? { ...place, savedAt } : null;
}

function readLastVisit(value: unknown): LastVisit | null {
  if (!isRecord(value)) return null;
  const place = readPlace(value);
  const visitedAt = readTime(value.visitedAt);
  return place && visitedAt !== null ? { ...place, visitedAt } : null;
}

// Never throws. Unreadable JSON or an unknown version starts empty; inside
// a good file, each bookmark that doesn't fit is dropped on its own.
export function parseStudyData(raw: string | null): StudyData {
  if (!raw) return EMPTY_DATA;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_DATA;
  }
  if (!isRecord(value)) return EMPTY_DATA;
  // A later format would be migrated here: if (value.version === 1) value = migrateV1(value)
  if (value.version !== 1) return EMPTY_DATA;

  const bookmarks: Bookmark[] = [];
  for (const item of Array.isArray(value.bookmarks) ? value.bookmarks : []) {
    const bookmark = readBookmark(item);
    if (bookmark && !bookmarks.some((b) => sameTarget(b, bookmark))) bookmarks.push(bookmark);
    if (bookmarks.length === MAX_BOOKMARKS) break;
  }
  return { version: 1, bookmarks, lastVisit: readLastVisit(value.lastVisit) };
}

export function serializeStudyData(data: StudyData): string {
  return JSON.stringify(data);
}

// ---- Changes. Each returns new data and leaves the old data alone ----

export function isBookmarked(data: StudyData, target: Target) {
  return data.bookmarks.some((b) => sameTarget(b, target));
}

// Adds the place to the top of the list, or removes it if it's already there
export function toggleBookmark(data: StudyData, place: StudyPlace, now: number): StudyData {
  if (isBookmarked(data, place)) return removeBookmark(data, place);
  const bookmark: Bookmark = { ...place, section: place.anchor ? place.section : null, savedAt: now };
  return { ...data, bookmarks: [bookmark, ...data.bookmarks].slice(0, MAX_BOOKMARKS) };
}

export function removeBookmark(data: StudyData, target: Target): StudyData {
  return { ...data, bookmarks: data.bookmarks.filter((b) => !sameTarget(b, target)) };
}

export function recordVisit(data: StudyData, place: StudyPlace, now: number): StudyData {
  return { ...data, lastVisit: { ...place, section: place.anchor ? place.section : null, visitedAt: now } };
}

// ---- Pages the dashboard can link to ----

export type StudyPageInfo = { key: string; label: string; title: string };

type PageSource = { ch: string; title: string };

export function studyPages(source: {
  chapters: readonly PageSource[];
  kana: readonly PageSource[];
  kanji: readonly PageSource[];
  docs: readonly { n: number; title: string; kind: string }[];
}): StudyPageInfo[] {
  const group = (kind: StudyPageKind, label: string, pages: readonly PageSource[]) =>
    pages.map((p) => ({ key: pageKey({ kind, id: p.ch }), label: `${label} ${p.ch}`, title: p.title }));
  return [
    ...group("chapter", "Chapter", source.chapters),
    ...group("kana", "Kana", source.kana),
    ...group("kanji", "Kanji", source.kanji),
    ...source.docs.map((d) => ({ key: pageKey({ kind: "lesson", id: String(d.n) }), label: d.kind || "Document", title: d.title })),
  ];
}

// ---- The store ----

export type StudySnapshot = {
  ready: boolean; // false only in the server render, before the browser has been read
  saved: boolean; // false when the browser blocks localStorage: changes last until the tab closes
  data: StudyData;
};

// What the server renders, and what the browser shows until hydration is done
export const SERVER_SNAPSHOT: StudySnapshot = { ready: false, saved: true, data: EMPTY_DATA };

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
type EventSource = Pick<EventTarget, "addEventListener" | "removeEventListener">;

// Reads localStorage on every snapshot, but returns the same object until
// the saved text changes, which is what useSyncExternalStore needs. When
// storage can't be read or written (blocked, private mode, full), it keeps
// working from memory and reports saved: false.
export function createStudyStore(options: { getStorage: () => StorageLike; getEvents?: () => EventSource }) {
  let storage: StorageLike | null | undefined; // undefined: not tried yet, null: unavailable
  let memory: string | null = null;
  let snapshot: StudySnapshot | undefined;
  let snapshotRaw: string | null = null;
  const listeners = new Set<() => void>();

  function usableStorage() {
    if (storage === undefined) {
      try {
        const s = options.getStorage();
        s.getItem(STORAGE_KEY); // throws when access is blocked
        storage = s;
      } catch {
        storage = null;
      }
    }
    return storage;
  }

  function readRaw(): string | null {
    const s = usableStorage();
    if (!s) return memory;
    try {
      return s.getItem(STORAGE_KEY);
    } catch {
      storage = null;
      return memory;
    }
  }

  function getSnapshot(): StudySnapshot {
    const raw = readRaw();
    const saved = storage !== null;
    if (!snapshot || raw !== snapshotRaw || saved !== snapshot.saved) {
      snapshotRaw = raw;
      snapshot = { ready: true, saved, data: parseStudyData(raw) };
    }
    return snapshot;
  }

  function update(change: (data: StudyData) => StudyData) {
    const raw = serializeStudyData(change(getSnapshot().data));
    memory = raw;
    const s = usableStorage();
    if (s) {
      try {
        s.setItem(STORAGE_KEY, raw);
      } catch {
        storage = null; // full or blocked: carry on from memory
      }
    }
    for (const listener of listeners) listener();
  }

  // Other tabs: the browser fires "storage" when they change the same key
  function subscribe(listener: () => void) {
    listeners.add(listener);
    const events = options.getEvents?.();
    const onStorage = (event: Event) => {
      const key = (event as StorageEvent).key;
      if (key === STORAGE_KEY || key === null) listener();
    };
    events?.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      events?.removeEventListener("storage", onStorage);
    };
  }

  return { getSnapshot, subscribe, update };
}
