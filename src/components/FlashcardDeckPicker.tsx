"use client";
import { useRef, useState } from "react";
import { parseFlashcardDeck, type FlashcardDeckInfo, type FlashcardDraft } from "@/lib/flashcards";

export default function FlashcardDeckPicker({ decks, onStart }: {
  decks: FlashcardDeckInfo[]; onStart: (drafts: FlashcardDraft[], keys: string[]) => string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function start() {
    if (pending.current || !selected.length) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    const choices = decks.filter((deck) => selected.includes(deck.key));
    try {
      const batches = await Promise.all(choices.map(async (deck) => {
        const response = await fetch("/flashcard-decks/" + encodeURIComponent(deck.slug));
        if (!response.ok) throw new Error("Could not load deck");
        return parseFlashcardDeck(await response.json(), deck.key);
      }));
      setMessage(onStart(batches.flat(), choices.map((deck) => deck.key)));
    } catch {
      setError("Could not load the selected decks. Nothing was added. Try again when your connection is available.");
    } finally { pending.current = false; setBusy(false); }
  }
  return (
    <section aria-label="Pre-made decks" className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Pre-made decks</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Choose chapters or study pages to add their vocabulary, kana characters, kanji and example sentences. Existing cards keep their review history. Your selection starts a shuffled review below.</p>
      <fieldset disabled={busy} className="mt-4">
        <legend className="sr-only">Select pre-made decks</legend>
        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {decks.map((deck) => <label key={deck.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border p-3 text-sm has-checked:border-accent-text has-checked:bg-accent-soft">
            <input type="checkbox" checked={selected.includes(deck.key)} onChange={() => setSelected((keys) => keys.includes(deck.key) ? keys.filter((key) => key !== deck.key) : [...keys, deck.key])} className="mt-1 size-4 shrink-0 accent-accent" />
            <span className="min-w-0"><span className="font-medium">{deck.label} — {deck.title}</span><span className="mt-1 block text-xs text-muted">{deck.count} cards</span></span>
          </label>)}
        </div>
      </fieldset>
      <button type="button" disabled={busy || !selected.length} onClick={start}
        className="mt-4 min-h-11 rounded-control border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
        {busy ? "Loading decks…" : "Add selected decks and review"}
      </button>
      {busy && <p role="status" className="mt-3 text-sm text-muted">Loading your selected decks…</p>}
      {message && <p role="status" className="mt-3 text-sm text-muted">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-muted">{error}</p>}
    </section>
  );
}
