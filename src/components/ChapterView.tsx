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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <Link href="/" className="rounded-control text-sm text-muted transition-colors hover:text-foreground">
        ← Back to search
      </Link>

      <p className="mt-6 text-sm font-medium uppercase tracking-wide text-subtle">
        {label} {chapter.ch}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{chapter.title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{chapter.intro}</p>

      {/* Jump links to each part of the page */}
      <nav aria-label="On this page" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {chapter.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Lessons, Vocabulary, Easy to mix up, Exercises, then Answer key, in that order */}
      {chapter.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-12">
          <h2 className="border-b border-border pb-2 text-2xl font-bold">{s.title}</h2>
          <div className="lesson" dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}

      {/* Previous and next page in the same section */}
      <nav aria-label={`${label} pages`} className="mt-16 flex flex-col gap-3 border-t border-border pt-6 text-sm sm:flex-row sm:justify-between">
        {prev ? (
          <Link href={`${basePath}/${prev.ch}`} className="rounded-control text-muted transition-colors hover:text-foreground">
            ← {label} {prev.ch}: {prev.title}
          </Link>
        ) : <span />}
        {next && (
          <Link href={`${basePath}/${next.ch}`} className="rounded-control text-muted transition-colors hover:text-foreground sm:text-right">
            {label} {next.ch}: {next.title} →
          </Link>
        )}
      </nav>
    </main>
  );
}
