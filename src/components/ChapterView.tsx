import Link from "next/link";
import type { Chapter } from "@/types/lesson";

// One page layout shared by chapters, kana and kanji
type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana" or "Kanji"
  basePath: string; // "/chapters", "/kana" or "/kanji"
  prev?: Chapter;
  next?: Chapter;
};

export default function ChapterView({ chapter, label, basePath, prev, next }: Props) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to search
        </Link>

        <p className="mt-6 text-sm font-medium uppercase tracking-wide text-neutral-500">
          {label} {chapter.ch}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{chapter.title}</h1>
        <p className="mt-3 leading-relaxed text-neutral-300">{chapter.intro}</p>

        {/* Jump links to each part of the page */}
        <nav className="mt-4 flex flex-wrap gap-2">
          {chapter.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:border-neutral-400"
            >
              {s.title}
            </a>
          ))}
        </nav>

        {/* Lessons, Vocabulary, Easy to mix up, Exercises, then Answer key, in that order */}
        {chapter.sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-12 scroll-mt-6">
            <h2 className="border-b border-neutral-800 pb-2 text-2xl font-bold">{s.title}</h2>
            <div className="lesson" dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ))}

        {/* Previous and next page in the same section */}
        <div className="mt-16 flex justify-between text-sm">
          {prev ? (
            <Link href={`${basePath}/${prev.ch}`} className="text-neutral-400 hover:text-neutral-100">
              ← {label} {prev.ch}: {prev.title}
            </Link>
          ) : <span />}
          {next && (
            <Link href={`${basePath}/${next.ch}`} className="text-neutral-400 hover:text-neutral-100">
              {label} {next.ch}: {next.title} →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
