"use client";

import { useSyncExternalStore } from "react";
import { createStudyStore, SERVER_SNAPSHOT } from "@/lib/study";

// One store for the whole tab, shared by the reader buttons and the dashboard.
// Nothing touches localStorage until the browser asks for a snapshot.
export const studyStore = createStudyStore({
  getStorage: () => window.localStorage,
  getEvents: () => window,
});

const serverSnapshot = () => SERVER_SNAPSHOT;

// The server and the first browser render (hydration) both use the server
// snapshot, so the HTML always matches. React then re-renders with what's
// saved, before the page is interactive.
export function useStudy() {
  return useSyncExternalStore(studyStore.subscribe, studyStore.getSnapshot, serverSnapshot);
}
