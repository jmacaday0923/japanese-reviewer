// Server-only: reads the full lesson data and returns the small search
// payload. Importing this from a client component fails the build, so the
// full JSON (with its HTML) never ends up in the browser bundle.
import "server-only";
import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";
import { buildSearchPayload, type SearchPayload } from "@/lib/search";

let payload: SearchPayload | undefined;

export function getSearchPayload(): SearchPayload {
  payload ??= buildSearchPayload(rawData as LessonData);
  return payload;
}
