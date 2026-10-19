// Reading aids are separate from bookmarks. This module has no React or browser globals.
export const READING_KEY = "japanese-reviewer:reading-visibility";
export const HINT_KINDS = ["romaji", "english", "kana"] as const;
export type HintKind = (typeof HINT_KINDS)[number];
export type ReadingVisibility = Record<HintKind, boolean>;
export const DEFAULT_VISIBILITY: ReadingVisibility = { romaji: true, english: true, kana: true };

export function parseReadingVisibility(raw: string | null): ReadingVisibility {
  try {
    const value = raw === null ? null : JSON.parse(raw);
    if (value?.version === 1 && ["romaji", "english"].every((kind) => typeof value.show?.[kind] === "boolean")) {
      // Keep choices from both older formats: the original furigana setting
      // controlled kana readings; the short-lived two-toggle format omitted it.
      return {
        romaji: value.show.romaji,
        english: value.show.english,
        kana: typeof value.show.kana === "boolean" ? value.show.kana
          : typeof value.show.furigana === "boolean" ? value.show.furigana : true,
      };
    }
  } catch { /* An invalid saved preference starts with all aids shown. */ }
  return { ...DEFAULT_VISIBILITY };
}

export type ReadingSnapshot = {
  ready: boolean;
  saved: boolean;
  show: ReadingVisibility;
  revision: number; // Changing preferences or re-hiding clears temporary reveals.
};
export const READING_SERVER_SNAPSHOT: ReadingSnapshot = {
  ready: false, saved: true, show: DEFAULT_VISIBILITY, revision: 0,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Options = { getStorage: () => StorageLike; getEvents?: () => EventTarget };

export function createReadingStore(options: Options) {
  let initialized = false;
  let storage: StorageLike | null = null;
  let memory: string | null = null;
  let previousRaw: string | null | undefined;
  let snapshot: ReadingSnapshot | undefined;
  const listeners = new Set<() => void>();

  function readRaw() {
    if (!initialized) {
      initialized = true;
      try { storage = options.getStorage(); } catch { storage = null; }
    }
    if (storage) {
      try { memory = storage.getItem(READING_KEY); } catch { storage = null; }
    }
    return memory;
  }

  function getSnapshot(): ReadingSnapshot {
    const raw = readRaw();
    const saved = storage !== null;
    if (!snapshot || raw !== previousRaw || saved !== snapshot.saved) {
      previousRaw = raw;
      snapshot = {
        ready: true, saved, show: parseReadingVisibility(raw),
        revision: snapshot ? snapshot.revision + 1 : 0,
      };
    }
    return snapshot;
  }
  function notify() { for (const listener of listeners) listener(); }
  function setShown(kind: HintKind, shown: boolean) {
    const current = getSnapshot();
    if (current.show[kind] === shown) return;
    memory = JSON.stringify({ version: 1, show: { ...current.show, [kind]: shown } });
    if (storage) {
      try { storage.setItem(READING_KEY, memory); } catch { storage = null; }
    }
    getSnapshot();
    notify();
  }
  function hideRevealed() {
    snapshot = { ...getSnapshot(), revision: getSnapshot().revision + 1 };
    notify();
  }
  function subscribe(listener: () => void) {
    listeners.add(listener);
    const events = options.getEvents?.();
    function onStorage(event: Event) {
      const key = (event as StorageEvent).key;
      if (key === READING_KEY || key === null) listener();
    }
    events?.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      events?.removeEventListener("storage", onStorage);
    };
  }
  return { getSnapshot, subscribe, setShown, hideRevealed };
}
