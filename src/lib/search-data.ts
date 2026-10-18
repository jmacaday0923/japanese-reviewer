// Server-only: builds the search index from the study pages. Importing this
// from a client component fails the build, so the page HTML never ends up in
// the browser bundle. The browser loads the index from /search-index.json.
import "server-only";
import { LIBRARY } from "@/lib/library";
import { buildChapterOptions, buildSearchIndex, type ChapterOption, type SearchIndex } from "@/lib/search";

let index: SearchIndex | undefined;

export function getSearchIndex(): SearchIndex {
  index ??= buildSearchIndex(LIBRARY);
  return index;
}

// The chapter filter's options: every chapter or group that has entries
export function getSearchChapters(): ChapterOption[] {
  return buildChapterOptions(getSearchIndex().entries.map((entry) => entry.ch));
}
