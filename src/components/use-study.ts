"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createStudyStore, hasLegacyPlaces, migrateStudyData, SERVER_SNAPSHOT, type LegacyLinks } from "@/lib/study";

// One store for the whole tab, shared by the reader buttons and the dashboard.
// Nothing touches localStorage until the browser asks for a snapshot.
export const studyStore = createStudyStore({
  getStorage: () => window.localStorage,
  getEvents: () => window,
});

const serverSnapshot = () => SERVER_SNAPSHOT;

// Bookmarks saved on the old document pages move to the study pages once.
// The map of old links is only downloaded when there is something to move.
let migrating = false;
function migrateOldPlaces() {
  if (migrating || !hasLegacyPlaces(studyStore.getSnapshot().data)) return;
  migrating = true;
  import("@/data/legacy-links.json")
    .then((module) => studyStore.update((data) => migrateStudyData(data, module.default as unknown as LegacyLinks)))
    .catch(() => {
      // Offline or a failed download: the old places stay hidden, and the next page load tries again
    })
    .finally(() => {
      migrating = false;
    });
}

// The server and the first browser render (hydration) both use the server
// snapshot, so the HTML always matches. React then re-renders with what's
// saved, before the page is interactive.
export function useStudy() {
  const snapshot = useSyncExternalStore(studyStore.subscribe, studyStore.getSnapshot, serverSnapshot);
  useEffect(migrateOldPlaces, [snapshot]);
  return snapshot;
}
