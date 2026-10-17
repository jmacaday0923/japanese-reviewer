import rawData from "@/data/lesson-data.json";
import rawChapters from "@/data/chapters.json";
import rawKana from "@/data/kana.json";
import rawKanji from "@/data/kanji.json";
import type { Chapter, LessonData } from "@/types/lesson";
import Search from "@/components/Search";
import ChapterCard from "@/components/ChapterCard";
import DocumentCard from "@/components/DocumentCard";

const data = rawData as LessonData;

// The three sections on the home page, each with its own pages.
// id is the anchor the navigation links to (/#chapters, /#kana, /#kanji).
const groups = [
  { id: "chapters", heading: "Chapters", label: "Chapter", basePath: "/chapters", pages: rawChapters as Chapter[] },
  { id: "kana", heading: "Kana", label: "Kana", basePath: "/kana", pages: rawKana as Chapter[] },
  { id: "kanji", heading: "Kanji", label: "Kanji", basePath: "/kanji", pages: rawKanji as Chapter[] },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-3xl font-bold tracking-tight">Japanese Lesson Reviewer</h1>
      <p className="mt-2 text-muted">
        {data.docs.length} documents, {data.items.length} searchable items
      </p>

      <Search />

      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-heading`} className="mt-12">
          <h2 id={`${g.id}-heading`} className="text-xl font-semibold">{g.heading}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.pages.map((c) => (
              <li key={c.ch}>
                <ChapterCard chapter={c} label={g.label} basePath={g.basePath} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section id="documents" aria-labelledby="documents-heading" className="mt-12">
        <h2 id="documents-heading" className="text-xl font-semibold">All documents</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.docs.map((doc) => (
            <li key={doc.n}>
              <DocumentCard doc={doc} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
