"use client";
import { useState } from "react";
import { addFlashcard, flashcardId, MAX_CARDS, type FlashcardDraft } from "@/lib/flashcards";
import { flashcardStore, useFlashcards } from "@/components/use-flashcards";
export default function AddFlashcard({ draft }: { draft: FlashcardDraft }) {
  const { ready, saved, data } = useFlashcards();
  const [message, setMessage] = useState("");
  const [attempted, setAttempted] = useState(false);
  const existing = data.cards.find((card) => card.id === flashcardId(draft));
  const added = !!existing?.sources.some((source) => source.href === draft.source.href);
  function add() {
    setAttempted(true);
    if (!existing && data.cards.length >= MAX_CARDS) { setMessage("Your deck is full. Remove a card before adding another."); return; }
    flashcardStore.update((data) => addFlashcard(data, draft, Date.now()));
  }
  return (
    <div className="min-w-36 py-1">
      <button type="button" disabled={!ready || added} aria-pressed={added}
        aria-label={(added ? "Saved to flashcards: " : "Add to flashcards: ") + draft.japanese}
        onClick={add} className="min-h-11 rounded-control border border-border-strong px-3 py-2 text-left text-xs font-medium text-accent-text hover:bg-accent-soft disabled:opacity-60">
        {added ? "Saved to flashcards" : "Add to flashcards"}
      </button>
      {ready && attempted && !saved && <p className="mt-1 max-w-48 text-xs text-muted">This browser cannot save flashcards. Unsaved changes are lost on reload.</p>}
      {message && <p role="status" className="mt-1 max-w-48 text-xs text-muted">{message}</p>}
    </div>
  );
}
