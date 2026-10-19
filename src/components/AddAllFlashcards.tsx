"use client";
import { useState } from "react";
import { addFlashcards, bulkAddMessage, flashcardId, type FlashcardDraft } from "@/lib/flashcards";
import { flashcardStore, useFlashcards } from "@/components/use-flashcards";

export default function AddAllFlashcards({ drafts }: { drafts: FlashcardDraft[] }) {
  const { ready, saved, data } = useFlashcards();
  const [message, setMessage] = useState("");
  const count = new Set(drafts.map(flashcardId)).size;
  const cards = new Map(data.cards.map((card) => [card.id, card]));
  const complete = drafts.every((draft) => cards.get(flashcardId(draft))?.sources.some((source) => source.href === draft.source.href));
  function add() {
    flashcardStore.update((data) => {
      const result = addFlashcards(data, drafts, Date.now());
      setMessage(bulkAddMessage(result));
      return result.data;
    });
  }
  return (
    <div className="min-w-40 py-1 text-left text-xs font-normal normal-case tracking-normal">
      <button type="button" disabled={!ready || complete} aria-pressed={complete} onClick={add}
        className="min-h-11 rounded-control border border-border-strong px-3 py-2 font-medium text-accent-text hover:bg-accent-soft disabled:opacity-60">
        {complete ? "All " + count + " saved" : "Add all " + count + " to flashcards"}
      </button>
      {message && <p role="status" className="mt-2 max-w-56 text-muted">{message}{!saved && " This browser cannot save flashcards. Unsaved changes are lost on reload."}</p>}
    </div>
  );
}
