import { Suspense } from "react";
import rawData from "@/data/lesson-data.json";
import rawChapters from "@/data/chapters.json";
import rawKana from "@/data/kana.json";
import rawKanji from "@/data/kanji.json";
import type { Chapter, LessonData } from "@/types/lesson";
import { getSearchPayload } from "@/lib/search-data";
import { studyPages } from "@/lib/study";
import Search, { SearchFallback } from "@/components/Search";
import OverviewStats from "@/components/OverviewStats";
import QuickAccess from "@/components/QuickAccess";
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
    { label: "Chapters", value: chapters.length },
    { label: "Kana & Kanji pages", value: kana.length + kanji.length },
    { label: "Documents", value: data.docs.length },
    { label: "Searchable entries", value: data.items.length },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {/* 1. Title and a short introduction */}
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">
        Japanese Lesson Reviewer
      </h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        Search your lessons, pick up where you left off, and read each chapter from its lessons through to the answer key.
      </p>

      {/* 2. Library numbers, with jump links to the sections further down */}
      <div className="mt-6 flex flex-col gap-3 rounded-card border border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <OverviewStats stats={stats} />
        <QuickAccess />
      </div>

      {/* 3. Search, near the top so it's there without scrolling */}
      <section
        id="search"
        aria-labelledby="search-heading"
        className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="search-heading" className="text-xl font-semibold tracking-tight">Search</h2>
          <p className="text-sm text-subtle">
            {data.docs.length} documents · {data.items.length.toLocaleString("en-US")} entries
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Kana, romaji or English. The chapter, kana and kanji study pages below aren&apos;t part of the search.
        </p>
        {/* Search reads the URL (?q=...), so it renders in the browser; the
            fallback keeps the same layout in the first HTML */}
        <Suspense fallback={<SearchFallback chapters={searchPayload.chapters} />}>
          <Search payload={searchPayload} />
        </Suspense>
      </section>

      {/* 4. Continue studying and Bookmarks, from this browser */}
      <StudyShelf pages={studyPages({ chapters, kana, kanji, docs: data.docs })} />

      {/* 5 to 7. Chapters, Kana and Kanji, then every document */}
      <StudySection
        id="chapters"
        heading="Chapters"
        description="Each chapter in order: lessons, vocabulary, easy-to-mix-up pairs, exercises, then the answer key."
        label="Chapter"
        basePath="/chapters"
        pages={chapters}
      />

      {/* Kana and Kanji sit side by side once there's room, so a single card
          doesn't float alone in a wide row */}
      <div className="md:grid md:grid-cols-2 md:gap-6">
        <StudySection
          id="kana"
          heading="Kana"
          description="Hiragana and katakana, learned as pairs."
          label="Kana"
          marker="あ"
          basePath="/kana"
          pages={kana}
        />
        <StudySection
          id="kanji"
          heading="Kanji"
          description="Readings, example words and practice."
          label="Kanji"
          marker="漢"
          basePath="/kanji"
          pages={kanji}
        />
      </div>

      <DocumentLibrary docs={data.docs} />
    </main>
  );
}
