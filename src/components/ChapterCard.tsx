import Link from "next/link";
import type { Chapter } from "@/types/lesson";
import type { StudyPageKind } from "@/lib/study";
import Icon from "@/components/Icon";
import LastOpenedBadge from "@/components/LastOpenedBadge";

type Props = {
  chapter: Chapter;
  kind: StudyPageKind; // to match the saved last visit
  label: string; // "Chapter", "Kana" or "Kanji"
  marker?: string; // あ or 漢 for Kana and Kanji; chapters show their number instead
  basePath: string; // "/chapters", "/kana" or "/kanji"
};

// How many lesson topics the page teaches: the h3 headings in its Lessons part
function topicCount(chapter: Chapter) {
  const lessons = chapter.sections.find((s) => s.id === "lessons");
  return lessons ? (lessons.html.match(/<h3[\s>]/g) ?? []).length : 0;
}

// Only the title is a link, so screen readers hear a short link name.
// Its ::after stretches over the card, so the whole card is still clickable.
// The card turns blue when the Last opened badge is inside it.
const CARD =
  "group relative flex h-full flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent-text has-[[data-last-opened]]:border-accent sm:p-5";
const LINK = "after:absolute after:inset-0 after:rounded-card focus-visible:outline-none";

export default function ChapterCard({ chapter, kind, label, marker, basePath }: Props) {
  const topics = topicCount(chapter);
  const footer = (
    <div className="mt-auto flex items-center justify-between pt-5 text-xs text-subtle">
      <span>
        {topics > 0 ? `${topics} ${topics === 1 ? "topic" : "topics"}` : `${chapter.sections.length} parts`}
      </span>
      <Icon name="arrow" className="size-4 transition-colors group-hover:text-accent-text" />
    </div>
  );

  if (marker) {
    // Kana and Kanji: a large character tile beside the title and a short intro
    return (
      <article className={CARD}>
        <div className="flex items-start gap-4">
          {/* Decorative: the label beside it already says which page this is */}
          <span
            aria-hidden="true"
            lang="ja"
            className="flex size-16 shrink-0 items-center justify-center rounded-card border border-border bg-surface-raised text-[2.25rem] leading-none text-foreground sm:size-20 sm:text-[2.75rem]"
          >
            {marker}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle">
                {label} {chapter.ch}
              </p>
              <LastOpenedBadge kind={kind} id={chapter.ch} />
            </div>
            <h3 className="mt-1 text-[1.0625rem] font-semibold leading-snug text-foreground">
              <Link href={`${basePath}/${chapter.ch}`} className={LINK}>
                {chapter.title}
              </Link>
            </h3>
            {chapter.intro && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{chapter.intro}</p>}
          </div>
        </div>
        {footer}
      </article>
    );
  }

  // Chapters: a number tile ("01", "02" ...) beside the label and title
  const number = /^\d+$/.test(chapter.ch) ? chapter.ch.padStart(2, "0") : chapter.ch;
  return (
    <article className={CARD}>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border bg-surface-raised text-lg font-semibold tabular-nums text-accent-text"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle">
              {label} {chapter.ch}
            </p>
            <LastOpenedBadge kind={kind} id={chapter.ch} />
          </div>
          <h3 className="mt-1 font-semibold leading-snug text-foreground">
            <Link href={`${basePath}/${chapter.ch}`} className={LINK}>
              {chapter.title}
            </Link>
          </h3>
        </div>
      </div>
      {footer}
    </article>
  );
}
