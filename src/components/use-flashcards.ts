"use client";
import { useSyncExternalStore } from "react";
import { addMistakes, createFlashcardStore, FLASHCARD_SERVER_SNAPSHOT, type FlashcardDraft } from "@/lib/flashcards";
export const flashcardStore = createFlashcardStore({ getStorage: () => window.localStorage, getEvents: () => window });
const serverSnapshot = () => FLASHCARD_SERVER_SNAPSHOT;
// Missed practice questions go straight into the flashcard deck as mistake cards.
export function saveMistakes(drafts: FlashcardDraft[]): boolean {
  return drafts.length > 0 && flashcardStore.update((data) => addMistakes(data, drafts, Date.now()));
}
export function useFlashcards() {
  return useSyncExternalStore(flashcardStore.subscribe, flashcardStore.getSnapshot, serverSnapshot);
}
