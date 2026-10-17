import Link from "next/link";
import type { Chapter } from "@/types/lesson";

type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana" or "Kanji"
  basePath: string; // "/chapters", "/kana" or "/kanji"
};

// How many lesson topics the page teaches: the h3 headings in its Lessons part
function topicCount(chapter: Chapter) {
  const lessons = chapter.sections.find((s) => s.id === "lessons");
  return lessons ? (lessons.html.match(/<h3[\s>]/g) ?? []).length : 0;
}

export default function ChapterCard({ chapter, label, basePath }: Props) {
  const topics = topicCount(chapter);

  // Only the title is a link, so screen readers hear a short link name.
  // Its ::after stretches over the card, so the whole card is still clickable.
  return (
    <article className="relative flex h-full flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label} {chapter.ch}
      </p>
      <h3 className="mt-1 font-medium text-foreground">
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
      <p className="mt-auto pt-3 text-xs text-subtle">
        {topics > 0
          ? `${topics} ${topics === 1 ? "topic" : "topics"}`
          : `${chapter.sections.length} parts`}
      </p>
    </article>
  );
}
