import { notFound } from "next/navigation";
import Link from "next/link";
import rawChapters from "@/data/chapters.json";
import type { Chapter } from "@/types/lesson";

const chapters = rawChapters as Chapter[];

// Pre-build a page for every chapter: /chapters/1 to /chapters/10
export function generateStaticParams() {
  return chapters.map((c) => ({ ch: c.ch }));
}

type Props = { params: Promise<{ ch: string }> };

export default async function ChapterPage({ params }: Props) {
  const { ch } = await params;
  const index = chapters.findIndex((c) => c.ch === ch);
  if (index === -1) notFound();

  const chapter = chapters[index];
  const prev = chapters[index - 1];
  const next = chapters[index + 1];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to search
        </Link>

        <p className="mt-6 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Chapter {chapter.ch}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{chapter.title}</h1>
        <p className="mt-3 leading-relaxed text-neutral-300">{chapter.intro}</p>

        {/* Jump links to each part of the chapter */}
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

        {/* Previous and next chapter */}
        <div className="mt-16 flex justify-between text-sm">
          {prev ? (
            <Link href={`/chapters/${prev.ch}`} className="text-neutral-400 hover:text-neutral-100">
              ← Chapter {prev.ch}
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/chapters/${next.ch}`} className="text-neutral-400 hover:text-neutral-100">
              Chapter {next.ch} →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
