import Link from "next/link";
import type { Chapter } from "@/types/lesson";
import { studyOutline } from "@/lib/toc";
import { NAV_ITEMS } from "@/components/nav-items";
import type { Crumb } from "@/components/Breadcrumbs";
import ReaderLayout from "@/components/ReaderLayout";
import LessonContent from "@/components/LessonContent";

// One page layout shared by chapters, kana and kanji
type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana" or "Kanji"
  basePath: string; // "/chapters", "/kana" or "/kanji"
  prev?: Chapter;
  next?: Chapter;
};

export default function ChapterView({ chapter, label, basePath, prev, next }: Props) {
  // The group's section on the home page: "/chapters" goes back to "/#chapters"
  const group = NAV_ITEMS.find((item) => item.href === `/#${basePath.slice(1)}`);
  const breadcrumbs: Crumb[] = [
    { label: "Home", href: "/" },
    ...(group ? [group] : []),
    { label: `${label} ${chapter.ch}` },
  ];

  return (
    <ReaderLayout
      breadcrumbs={breadcrumbs}
      eyebrow={`${label} ${chapter.ch}`}
      title={chapter.title}
      intro={chapter.intro}
      outline={studyOutline(chapter.sections, chapter.toc)}
      footer={
        // Previous and next page in the same section
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
      }
    >
      {/* Lessons, Vocabulary, Easy to mix up, Exercises, then Answer key, in that order */}
      {chapter.sections.map((s, i) => (
        <section key={s.id} id={s.id} className={i === 0 ? "mt-10" : "mt-12"}>
          <h2 className="border-b border-border pb-2 text-2xl font-bold">{s.title}</h2>
          <LessonContent html={s.html} />
        </section>
      ))}
    </ReaderLayout>
  );
}
