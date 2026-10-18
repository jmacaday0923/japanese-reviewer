// Every study page, grouped the way the home page, the search and the
// bookmarks list them. Server only: the page data is large, and only the
// parts each page needs should reach the browser.
import "server-only";
import rawChapters from "@/data/chapters.json";
import rawKana from "@/data/kana.json";
import rawKanji from "@/data/kanji.json";
import rawPractice from "@/data/practice.json";
import type { Chapter } from "@/types/lesson";
import type { SearchSource } from "@/lib/search";

export const chapters = rawChapters as Chapter[];
export const kana = rawKana as Chapter[];
export const kanji = rawKanji as Chapter[];
export const practice = rawPractice as Chapter[];

export const LIBRARY: SearchSource[] = [
  { kind: "chapter", label: "Chapter", basePath: "/chapters", pages: chapters },
  { kind: "kana", label: "Kana", basePath: "/kana", pages: kana },
  { kind: "kanji", label: "Kanji", basePath: "/kanji", pages: kanji },
  { kind: "practice", label: "Practice", basePath: "/practice", pages: practice },
];
