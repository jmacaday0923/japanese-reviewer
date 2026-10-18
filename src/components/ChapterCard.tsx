import Link from "next/link";
import type { Chapter } from "@/types/lesson";

type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana" or "Kanji"
  marker?: string; // あ or 漢 for Kana and Kanji; chapters show their number instead
  basePath: string; // "/chapters", "/kana" or "/kanji"
};

// How many lesson topics the page teaches: the h3 headings in its Lessons part
function topicCount(chapter: Chapter) {
  const lessons = chapter.sections.find((s) => s.id === "lessons");
  return lessons ? (lessons.html.match(/<h3[\s>]/g) ?? []).length : 0;
}

export default function ChapterCard({ chapter, label, marker, basePath }: Props) {
  const topics = topicCount(chapter);
  // "01", "02" ... for numbered pages
  const number = /^\d+$/.test(chapter.ch) ? chapter.ch.padStart(2, "0") : chapter.ch;

  // Only the title is a link, so screen readers hear a short link name.
  // Its ::after stretches over the card, so the whole card is still clickable.
  return (
    <article className="group relative flex h-full flex-col rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">
          {label} {chapter.ch}
        </p>
        {/* Decorative: the label above already says which page this is */}
        {marker ? (
          <span aria-hidden="true" lang="ja" className="-mt-1 text-[1.75rem] leading-none text-subtle">
            {marker}
          </span>
        ) : (
          <span aria-hidden="true" className="-mt-1 font-mono text-[1.75rem] font-medium leading-none tabular-nums text-accent-text">
            {number}
          </span>
        )}
      </div>
      <h3 className="mt-3 text-[1.0625rem] font-semibold leading-snug text-foreground">
        <Link
          href={`${basePath}/${chapter.ch}`}
          className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
        >
          {chapter.title}
        </Link>
      </h3>
      {chapter.intro && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{chapter.intro}</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-subtle">
        <span>
          {topics > 0
            ? `${topics} ${topics === 1 ? "topic" : "topics"}`
            : `${chapter.sections.length} parts`}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 transition-colors group-hover:text-accent-text">
          <path d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5" />
        </svg>
      </div>
    </article>
  );
}
