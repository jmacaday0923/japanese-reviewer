import Link from "next/link";
import type { Chapter } from "@/types/lesson";

type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana" or "Kanji"
  basePath: string; // "/chapters", "/kana" or "/kanji"
};

export default function ChapterCard({ chapter, label, basePath }: Props) {
  return (
    <Link
      href={`${basePath}/${chapter.ch}`}
      className="flex h-full flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label} {chapter.ch}
      </span>
      <span className="mt-1 font-medium text-foreground">{chapter.title}</span>
    </Link>
  );
}
