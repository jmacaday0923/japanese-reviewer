"use client";

import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  createReadingStore, HINT_KINDS, READING_SERVER_SNAPSHOT,
  type HintKind, type ReadingSnapshot,
} from "@/lib/reading-preferences";

const store = createReadingStore({ getStorage: () => window.localStorage, getEvents: () => window });
const serverSnapshot = () => READING_SERVER_SNAPSHOT;
const ReadingContext = createContext<ReadingSnapshot | null>(null);
const LABELS: Record<HintKind, string> = { romaji: "Romaji", english: "English", kana: "Kana readings" };

export function ReadingProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
  return <ReadingContext.Provider value={snapshot}>{children}</ReadingContext.Provider>;
}
function useReading() {
  const value = useContext(ReadingContext);
  if (!value) throw new Error("ReadingProvider must wrap the application.");
  return value;
}
function useReveal(kind: HintKind) {
  const snapshot = useReading();
  const [local, setLocal] = useState({ revision: -1, open: false });
  const revealed = local.revision === snapshot.revision && local.open;
  return {
    ready: snapshot.ready,
    hiddenByPreference: !snapshot.show[kind],
    visible: snapshot.ready && (snapshot.show[kind] || revealed),
    toggle: () => setLocal({ revision: snapshot.revision, open: !revealed }),
  };
}

export function ReadingControls() {
  const snapshot = useReading();
  return (
    <fieldset disabled={!snapshot.ready} className="mt-5 min-w-0 rounded-card border border-border bg-surface p-3 sm:p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Reading aids</legend>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {HINT_KINDS.map((kind) => (
          <label key={kind} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              aria-label={"Show " + (kind === "kana" ? "kana readings" : kind)}
              checked={snapshot.show[kind]}
              onChange={(event) => store.setShown(kind, event.target.checked)}
              className="size-4 shrink-0 accent-accent"
            />
            {LABELS[kind]}
          </label>
        ))}
        <button type="button" onClick={store.hideRevealed} className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-text hover:bg-accent-soft disabled:opacity-50">
          Hide revealed hints
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-subtle">
        Uncheck an aid to practise, then reveal individual hints. Choices apply across study pages and search.
      </p>
      {snapshot.ready && !snapshot.saved && (
        <p className="mt-1 text-xs text-muted">This browser cannot save these choices; they last for this tab.</p>
      )}
    </fieldset>
  );
}

const REVEAL_BUTTON = "z-10 inline-flex min-h-9 items-center rounded-control border border-border-strong text-xs font-medium text-accent-text hover:bg-accent-soft";

export function ReadingHint({ kind, context, children }: { kind: HintKind; context: string; children: ReactNode }) {
  const { ready, hiddenByPreference, visible, toggle } = useReveal(kind);
  const id = useId();
  const label = kind === "kana" ? "kana reading" : LABELS[kind];
  return (
    <span data-reading-hint={kind} className="relative inline-block min-h-9 min-w-28 max-w-full align-middle">
      {!ready && <span className="sr-only">Loading reading preferences</span>}
      <span id={id} aria-hidden={!visible} style={{ visibility: visible ? "visible" : "hidden" }}>{children}</span>
      {ready && hiddenByPreference && (
        <button type="button" onClick={toggle} aria-expanded={visible} aria-controls={id}
          aria-label={(visible ? "Hide " : "Reveal ") + label + " for " + context}
          className={REVEAL_BUTTON + " px-2.5" + (visible ? " relative mt-1" : " absolute left-0 top-0")}>
          {visible ? "Hide " : "Reveal "}{label}
        </button>
      )}
    </span>
  );
}
