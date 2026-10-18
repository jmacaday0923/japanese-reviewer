import { Suspense } from "react";
import rawData from "@/data/lesson-data.json";
import rawChapters from "@/data/chapters.json";
import rawKana from "@/data/kana.json";
import rawKanji from "@/data/kanji.json";
import type { Chapter, LessonData } from "@/types/lesson";
import { getSearchPayload } from "@/lib/search-data";
import { studyPages } from "@/lib/study";
import { documentSummaries } from "@/lib/documents";
import Search, { SearchFallback } from "@/components/Search";
import OverviewStats from "@/components/OverviewStats";
import StudySection from "@/components/StudySection";
import DocumentLibrary from "@/components/DocumentLibrary";
import StudyShelf from "@/components/StudyShelf";

const data = rawData as LessonData;
const chapters = rawChapters as Chapter[];
const kana = rawKana as Chapter[];
const kanji = rawKanji as Chapter[];

export default function Home() {
  // Only the fields the search needs; the full JSON stays on the server
  const searchPayload = getSearchPayload();

  const stats = [
    { label: "chapters", value: chapters.length, icon: "chapters" },
    { label: "kana & kanji pages", value: kana.length + kanji.length, icon: "book" },
    { label: "documents", value: data.docs.length, icon: "documents" },
    { label: "searchable entries", value: data.items.length, icon: "search" },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {/* 1. Heading and a short subtitle */}
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">
        Your study space
      </h1>
      <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted">
        Search your notes. Pick up a lesson. Keep moving forward.
      </p>

      {/* 2. Library numbers, all counted from the data files */}
      <OverviewStats stats={[...stats]} />

      {/* 3. Continue studying and Bookmarks, from this browser */}
      <StudyShelf pages={studyPages({ chapters, kana, kanji, docs: data.docs })} />

      {/* 4. Search */}
      <section
        id="search"
        aria-labelledby="search-heading"
        className="mt-4 rounded-card border border-border bg-surface p-4 sm:p-6"
      >
        <h2 id="search-heading" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Find something to review
        </h2>
        {/* Search reads the URL (?q=...), so it renders in the browser; the
            fallback keeps the same layout in the first HTML */}
        <Suspense fallback={<SearchFallback chapters={searchPayload.chapters} />}>
          <Search payload={searchPayload} />
        </Suspense>
      </section>

      {/* 5. Chapters */}
      <StudySection
        id="chapters"
        heading="Chapters"
        description="Work through lessons, vocabulary, exercises and answer keys, one chapter at a time."
        meta={`${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}`}
        groups={[{ kind: "chapter", label: "Chapter", basePath: "/chapters", pages: chapters }]}
      />

      {/* 6. Kana and Kanji share one section; #kana and #kanji stay as anchors */}
      <StudySection
        id="kana-kanji"
        heading="Kana & kanji"
        description="Hiragana, katakana and kanji study pages."
        groups={[
          { id: "kana", kind: "kana", label: "Kana", marker: "あ", basePath: "/kana", pages: kana },
          { id: "kanji", kind: "kanji", label: "Kanji", marker: "漢", basePath: "/kanji", pages: kanji },
        ]}
      />

      {/* 7. Every document, with content tags worked out here on the server */}
      <DocumentLibrary docs={documentSummaries(data)} />
    </main>
  );
}
