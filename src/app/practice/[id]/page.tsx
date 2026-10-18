import { notFound } from "next/navigation";
import raw from "@/data/practice.json";
import type { Chapter } from "@/types/lesson";
import ChapterView from "@/components/ChapterView";

const pages = raw as Chapter[];

// Pre-build a page for every practice set: /practice/1 and so on
export function generateStaticParams() {
  return pages.map((c) => ({ id: c.ch }));
}

// This page is all URL data (which practice set), so it can't come from the
// shared shell that links prefetch. It's prerendered, so the wait is short;
// allowing it to block keeps the full content in the first HTML, which is
// what makes direct #anchor links land reliably.
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function PracticePage({ params }: Props) {
  const { id } = await params;
  const index = pages.findIndex((c) => c.ch === id);
  if (index === -1) notFound();

  return (
    <ChapterView
      chapter={pages[index]}
      label="Practice"
      basePath="/practice"
      prev={pages[index - 1]}
      next={pages[index + 1]}
    />
  );
}
