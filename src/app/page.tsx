import { Suspense } from "react";
import { chapters, kana, kanji, LIBRARY } from "@/lib/library";
import { getSearchChapters, getSearchIndex } from "@/lib/search-data";
import { studyPages } from "@/lib/study";
import Search, { SearchFallback } from "@/components/Search";
import OverviewStats from "@/components/OverviewStats";
import StudySection from "@/components/StudySection";
import StudyShelf from "@/components/StudyShelf";
import ListeningShelf from "@/components/ListeningShelf";
import { checkpointExams } from "@/lib/checkpoint-data";
import CheckpointShelf from "@/components/CheckpointShelf";

export default function Home() {
  // Only the filter options go into the page; the search loads its index
  // from /search-index.json when it's first used
  const searchChapters = getSearchChapters();

  const stats = [
    { label: "chapters", value: chapters.length, icon: "chapters" },
    { label: "kana & kanji pages", value: kana.length + kanji.length, icon: "book" },
    { label: "checkpoints", value: checkpointExams.length, icon: "practice" },
    { label: "searchable entries", value: getSearchIndex().entries.length, icon: "search" },
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
      <StudyShelf pages={studyPages(LIBRARY)} />

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
        <Suspense fallback={<SearchFallback chapters={searchChapters} />}>
          <Search chapters={searchChapters} />
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

      <CheckpointShelf />
      <ListeningShelf />
    </main>
  );
}
