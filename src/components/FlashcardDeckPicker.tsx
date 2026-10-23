"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { parseFlashcardDeck, type FlashcardDeckInfo, type FlashcardDraft } from "@/lib/flashcards";

// Two kinds of pre-made deck, one tab each. A selection can mix decks from both tabs.
const TABS = [
  { label: "All cards", vocabularyOnly: false, description: "Choose chapters or study pages to add their vocabulary, kana characters, kanji and example sentences." },
  { label: "Vocabulary only", vocabularyOnly: true, description: "Choose chapters to add only their vocabulary words, without the lesson sentences. These are the same word cards as in the full chapter decks." },
];

export default function FlashcardDeckPicker({ decks, onStart }: {
  decks: FlashcardDeckInfo[]; onStart: (drafts: FlashcardDraft[], keys: string[]) => string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  async function start() {
    if (pending.current || !selected.length) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const choices = decks.filter((deck) => selected.includes(deck.slug));
    try {
      const batches = await Promise.all(choices.map(async (deck) => {
        const response = await fetch("/flashcard-decks/" + encodeURIComponent(deck.slug));
        if (!response.ok) throw new Error("Could not load deck");
        return parseFlashcardDeck(await response.json(), deck.key);
      }));
      setMessage(onStart(batches.flat(), [...new Set(choices.map((deck) => deck.key))]));
    } catch {
      setError("Could not load the selected decks. Nothing was added. Try again when your connection is available.");
    } finally { pending.current = false; setBusy(false); }
  }
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length
      : event.key === "ArrowLeft" ? (index + last) % TABS.length
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault(); setTab(next); tabs.current[next]?.focus();
  }
  return (
    <section aria-label="Pre-made decks" className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Pre-made decks</h2>
      <div role="tablist" aria-label="Deck type" className="mt-3 flex flex-wrap gap-2">
        {TABS.map((item, index) => (
          <button key={item.label} ref={node => { tabs.current[index] = node; }} type="button" role="tab"
            id={id + "-tab-" + index} aria-controls={id + "-panel-" + index} aria-selected={tab === index}
            tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={event => move(event, index)}
            className={"min-h-11 rounded-full border px-4 text-sm " + (tab === index ? "border-accent bg-accent font-medium text-accent-foreground" : "border-border text-muted hover:bg-surface-raised")}>
            {item.label}
          </button>
        ))}
      </div>
      {TABS.map((item, index) => (
        <div key={item.label} role="tabpanel" id={id + "-panel-" + index} aria-labelledby={id + "-tab-" + index} hidden={tab !== index}>
          <p className="mt-3 text-sm leading-relaxed text-muted">{item.description} Existing cards keep their review history. Your selection starts a shuffled review below.</p>
          <fieldset disabled={busy} className="mt-4">
            <legend className="sr-only">Select {item.label.toLowerCase()} decks</legend>
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {decks.filter((deck) => !!deck.vocabularyOnly === item.vocabularyOnly).map((deck) => <label key={deck.slug} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border p-3 text-sm has-checked:border-accent-text has-checked:bg-accent-soft">
                <input type="checkbox" checked={selected.includes(deck.slug)} onChange={() => setSelected((slugs) => slugs.includes(deck.slug) ? slugs.filter((slug) => slug !== deck.slug) : [...slugs, deck.slug])} className="mt-1 size-4 shrink-0 accent-accent" />
                <span className="min-w-0"><span className="font-medium">{deck.label} — {deck.title}</span><span className="mt-1 block text-xs text-muted">{deck.count} {deck.vocabularyOnly ? "words" : "cards"}</span></span>
              </label>)}
            </div>
          </fieldset>
        </div>
      ))}
      <button type="button" disabled={busy || !selected.length} onClick={start}
        className="mt-4 min-h-11 rounded-control border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
        {busy ? "Loading decks…" : "Add selected decks and review"}
      </button>
      {selected.length > 0 && <p className="mt-2 text-xs text-muted">{selected.length} {selected.length === 1 ? "deck" : "decks"} selected</p>}
      {busy && <p role="status" className="mt-3 text-sm text-muted">Loading your selected decks…</p>}
      {message && <p role="status" className="mt-3 text-sm text-muted">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-muted">{error}</p>}
    </section>
  );
}
