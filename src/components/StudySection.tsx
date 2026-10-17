import type { Chapter } from "@/types/lesson";
import ChapterCard from "@/components/ChapterCard";

type Props = {
  id: string; // anchor the navigation links to
  heading: string;
  description: string;
  label: string;
  basePath: string;
  pages: Chapter[];
};

// One study group (Chapters, Kana or Kanji): heading, short description, card grid.
// The grid fills the width it is given: one card stretches across its column,
// many cards wrap into as many columns as fit.
export default function StudySection({ id, heading, description, label, basePath, pages }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">{heading}</h2>
        <p className="text-sm text-subtle">
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
        {pages.map((c) => (
          <li key={c.ch}>
            <ChapterCard chapter={c} label={label} basePath={basePath} />
          </li>
        ))}
      </ul>
    </section>
  );
}
