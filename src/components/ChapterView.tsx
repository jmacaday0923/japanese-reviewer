import catalog from "@/data/japanese-display.json";
import { studyDisplay } from "@/lib/study-markup";
import StudyText from "@/components/StudyText";
import type { TocNode } from "@/lib/toc";
import Link from "next/link";
import type { Chapter } from "@/types/lesson";
import { studyOutline } from "@/lib/toc";
import { NAV_ITEMS } from "@/components/nav-items";
import type { Crumb } from "@/components/Breadcrumbs";
import ReaderLayout from "@/components/ReaderLayout";
import LessonContent from "@/components/LessonContent";
import type { StudyPageKind } from "@/lib/study";
import type { ChapterExercises } from "@/types/exercise";
import { collectFlashcardExamples } from "@/lib/flashcard-content";
import SentencePractice from "@/components/SentencePractice";
import { chapterSentenceExercises } from "@/lib/sentence-bank";
import InteractiveExercises from "@/components/InteractiveExercises";

const KINDS = { "/chapters": "chapter", "/kana": "kana", "/kanji": "kanji", "/practice": "practice" } as const satisfies Record<string, StudyPageKind>;

// One page layout shared by chapters, kana, kanji and practice
type Props = {
  chapter: Chapter;
  label: string; // "Chapter", "Kana", "Kanji" or "Practice"
  basePath: keyof typeof KINDS; // "/chapters", "/kana", "/kanji" or "/practice"
  prev?: Chapter;
  next?: Chapter;
  exercises?: ChapterExercises | null; // interactive practice, for chapters that have it
};

export default function ChapterView({ chapter, label, basePath, prev, next, exercises }: Props) {
  const sentencePractice = basePath === "/chapters" ? chapterSentenceExercises(chapter.ch) : null;
  const examples = collectFlashcardExamples(chapter.sections, { kind: KINDS[basePath], id: chapter.ch });
  // The group's section on the home page: "/chapters" goes back to "/#chapters"
  const group = NAV_ITEMS.find((item) => item.href === `/#${basePath.slice(1)}`);
  const breadcrumbs: Crumb[] = [
    { label: "Home", href: "/" },
    ...(group ? [group] : []),
    { label: `${label} ${chapter.ch}` },
  ];

  const labels = (nodes: TocNode[]): TocNode[] => nodes.map(node => ({ ...node,
    label: studyDisplay(catalog, node.label, `${KINDS[basePath]}/${chapter.ch}/exercises`).primary,
    children: labels(node.children),
  }));
  return (
    <ReaderLayout
      page={{ kind: KINDS[basePath], id: chapter.ch }}
      breadcrumbs={breadcrumbs}
      eyebrow={`${label} ${chapter.ch}`}
      title={chapter.title}
      intro={<StudyText display={studyDisplay(catalog, chapter.intro ?? "")} />}
      outline={labels(studyOutline(chapter.sections, chapter.toc))}
      footer={
        // Previous and next page in the same section
        <nav aria-label={`${label} pages`} className="mt-16 grid gap-3 border-t border-border pt-6 text-sm sm:grid-cols-2">
          {prev ? (
            <Link href={`${basePath}/${prev.ch}`} className="flex flex-col rounded-card border border-border px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface">
              <span className="text-xs text-subtle"><span aria-hidden="true">← </span>Previous</span>
              <span className="mt-0.5 font-medium text-foreground">{label} {prev.ch}: {prev.title}</span>
            </Link>
          ) : <span className="hidden sm:block" />}
          {next && (
            <Link href={`${basePath}/${next.ch}`} className="flex flex-col rounded-card border border-border px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface sm:text-right">
              <span className="text-xs text-subtle">Next<span aria-hidden="true"> →</span></span>
              <span className="mt-0.5 font-medium text-foreground">{label} {next.ch}: {next.title}</span>
            </Link>
          )}
        </nav>
      }
    >
      {/* Lessons, Vocabulary, Easy to mix up, Exercises, then Answer key, in that order */}
      {chapter.sections.map((s, i) => (
        <section key={s.id} id={s.id} className={i === 0 ? "mt-12" : "mt-16"}>
          <h2 className="border-b border-border pb-3 text-[1.625rem] font-semibold tracking-tight">{s.title}</h2>
          {/* Practice first, then the original exercise tables as reference.
              Keyed by chapter, so answers never carry over to another chapter. */}
          {s.id === "exercises" && exercises && exercises.sets.length > 0 && (
            <InteractiveExercises key={exercises.chapter} exercises={exercises} />
          )}
          {s.id === "exercises" && sentencePractice && (
            <SentencePractice key={chapter.ch} exercises={sentencePractice} />
          )}
          <LessonContent html={s.html} className="mt-6"
            source={{ kind: KINDS[basePath], id: chapter.ch, sectionId: s.id, sectionTitle: s.title }} examples={examples} />
        </section>
      ))}
      {basePath === "/chapters" && chapter.ch === "10" && <section aria-labelledby="chapter-checkpoint-heading" className="mt-12 rounded-card border border-border bg-surface p-5">
        <h2 id="chapter-checkpoint-heading" className="text-xl font-semibold">Ready for your checkpoint?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Assess Chapters 1–10 with separate vocabulary and grammar exams. Most questions focus on Chapters 6–10.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/checkpoints/vocabulary" className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">Vocabulary checkpoint</Link>
          <Link href="/checkpoints/grammar" className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 py-2 text-sm text-accent-text hover:bg-accent-soft">Grammar checkpoint</Link>
        </div>
      </section>}
    </ReaderLayout>
  );
}
