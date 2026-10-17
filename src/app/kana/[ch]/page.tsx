import { notFound } from "next/navigation";
import raw from "@/data/kana.json";
import type { Chapter } from "@/types/lesson";
import ChapterView from "@/components/ChapterView";

const pages = raw as Chapter[];

// Pre-build a page for every entry: /kana/1 (Hiragana) and /kana/2 (Katakana)
export function generateStaticParams() {
  return pages.map((c) => ({ ch: c.ch }));
}

type Props = { params: Promise<{ ch: string }> };

export default async function KanaPage({ params }: Props) {
  const { ch } = await params;
  const index = pages.findIndex((c) => c.ch === ch);
  if (index === -1) notFound();

  return (
    <ChapterView
      chapter={pages[index]}
      label="Kana"
      basePath="/kana"
      prev={pages[index - 1]}
      next={pages[index + 1]}
    />
  );
}
