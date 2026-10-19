"use client";
import { useSyncExternalStore } from "react";
import { createFlashcardStore, FLASHCARD_SERVER_SNAPSHOT } from "@/lib/flashcards";
export const flashcardStore = createFlashcardStore({ getStorage: () => window.localStorage, getEvents: () => window });
const serverSnapshot = () => FLASHCARD_SERVER_SNAPSHOT;
export function useFlashcards() {
  return useSyncExternalStore(flashcardStore.subscribe, flashcardStore.getSnapshot, serverSnapshot);
}
