import type { Chapter } from "@/types/lesson";
import type { StudyPageKind } from "@/lib/study";
import ChapterCard from "@/components/ChapterCard";

type Group = {
  id?: string; // anchor on this group's first card, like "kana"
  kind: StudyPageKind;
  label: string;
  marker?: string; // a character tile on each card, like あ for Kana
  basePath: string;
  pages: Chapter[];
};

type Props = {
  id: string; // anchor the navigation links to
  heading: string;
  description: string;
  meta?: string; // a short note on the right, like "10 chapters"
  groups: Group[];
};

// A study area of the dashboard: heading, short description, cards.
// Chapters: one column on phones, two on tablets, three on wide screens.
// Kana & kanji: one shared grid, two columns from tablets up, with each
// group's first card keeping the group's anchor, so /#kana and /#kanji still
// land on their cards. Every row is the same height from tablets up.
export default function StudySection({ id, heading, description, meta, groups }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight text-foreground">{heading}</h2>
        {meta && <p className="text-sm text-subtle">{meta}</p>}
      </div>
      <p className="mt-1 text-sm text-muted">{description}</p>

      <ul
        className={
          "mt-5 grid gap-3 sm:auto-rows-fr " + (groups.length === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")
        }
      >
        {groups.flatMap((group) =>
          group.pages.map((c, i) => (
            <li key={`${group.basePath}/${c.ch}`} id={i === 0 ? group.id : undefined}>
              <ChapterCard chapter={c} kind={group.kind} label={group.label} marker={group.marker} basePath={group.basePath} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
