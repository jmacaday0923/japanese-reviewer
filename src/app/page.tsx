import { Suspense } from "react";
import rawData from "@/data/lesson-data.json";
import rawChapters from "@/data/chapters.json";
import rawKana from "@/data/kana.json";
import rawKanji from "@/data/kanji.json";
import type { Chapter, LessonData } from "@/types/lesson";
import { getSearchPayload } from "@/lib/search-data";
import Search, { SearchFallback } from "@/components/Search";
import OverviewStats from "@/components/OverviewStats";
import QuickAccess from "@/components/QuickAccess";
import StudySection from "@/components/StudySection";
import DocumentLibrary from "@/components/DocumentLibrary";

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
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Japanese Lesson Reviewer</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Review your Japanese lessons in one place. Search vocabulary, grammar, kana and kanji, read each
        chapter from its lessons through to the answer key, or open the original documents.
      </p>

      <OverviewStats stats={stats} />

      <QuickAccess />

      <section
        id="search"
        aria-labelledby="search-heading"
        className="mt-10 rounded-card border border-border bg-surface p-4 sm:p-6"
      >
        <h2 id="search-heading" className="text-xl font-semibold">Search</h2>
        <p className="mt-1 text-sm text-muted">
          Searches the {data.docs.length} documents ({data.items.length.toLocaleString("en-US")} entries)
          in kana, romaji or English. Narrow it with a category or a chapter. The chapter, kana and
          kanji pages below are separate study pages and are not part of the search.
        </p>
        {/* Search reads the URL (?q=...), so it renders in the browser; the
            fallback keeps the same layout in the first HTML */}
        <Suspense fallback={<SearchFallback chapters={searchPayload.chapters} />}>
          <Search payload={searchPayload} />
        </Suspense>
      </section>

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
          basePath="/kana"
          pages={kana}
        />
        <StudySection
          id="kanji"
          heading="Kanji"
          description="Readings, example words and practice."
          label="Kanji"
          basePath="/kanji"
          pages={kanji}
        />
      </div>

      <DocumentLibrary docs={data.docs} />
    </main>
  );
}
