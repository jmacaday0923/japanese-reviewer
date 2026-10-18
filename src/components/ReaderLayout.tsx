import type { ReactNode } from "react";
import { countLinks, type TocNode } from "@/lib/toc";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import TableOfContents from "@/components/TableOfContents";
import BookmarkControls from "@/components/BookmarkControls";
import type { StudyPageKind } from "@/lib/study";

// The shared frame for every reader page (chapters, kana, kanji, documents):
// breadcrumbs, title block, reading column, outline, and an optional footer
// such as previous/next links. It owns the page's one <main> and one <h1>.
//
// Wide screens (xl, 1280px and up, where the 15rem site sidebar still leaves
// room) get a two-column grid with a sticky outline on the right. Smaller
// screens get the same outline as a collapsed disclosure above the content.
// Pages with no outline stay a single centered column.
type Props = {
  page: { kind: StudyPageKind; id: string }; // which page this is, for bookmarks
  breadcrumbs: Crumb[];
  eyebrow?: string;  // small line above the title, like "Chapter 3"
  title: string;
  meta?: ReactNode;  // like "Reviewer · Oct 8, 2026"
  intro?: ReactNode;
  outline: TocNode[];
  footer?: ReactNode;
  children: ReactNode;
};

export default function ReaderLayout({ page, breadcrumbs, eyebrow, title, meta, intro, outline, footer, children }: Props) {
  const hasOutline = outline.length > 0;
  const links = countLinks(outline);

  return (
    <main
      className={
        "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10 " +
        (hasOutline ? "xl:grid xl:max-w-[68rem] xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-x-12 xl:px-10" : "")
      }
    >
      <header className="min-w-0 xl:col-start-1">
        <Breadcrumbs items={breadcrumbs} />
        {eyebrow && <p className="mt-8 text-xs font-medium uppercase tracking-[0.08em] text-accent-text">{eyebrow}</p>}
        <h1 className={(eyebrow ? "mt-2" : "mt-8") + " text-3xl font-semibold leading-tight tracking-tight break-words sm:text-[2.25rem]"}>{title}</h1>
        {meta && <p className="mt-2 text-sm text-subtle">{meta}</p>}
        {intro && <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">{intro}</p>}
        <BookmarkControls kind={page.kind} id={page.id} outline={outline} />

        {hasOutline && (
          // Phones, tablets and narrow desktops: a compact outline you open when needed
          <details className="group/outline mt-6 rounded-card border border-border bg-surface xl:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>
                On this page <span className="font-normal text-subtle">({links} links)</span>
              </span>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-subtle transition-transform group-open/outline:rotate-180">
                <path d="M6 8l4 4 4-4" />
              </svg>
            </summary>
            <nav aria-label="On this page" className="border-t border-border p-2">
              <TableOfContents nodes={outline} />
            </nav>
          </details>
        )}
      </header>

      {hasOutline && (
        // Wide screens: beside the text, sticky below the site header, scrolling on its own when long
        <aside className="hidden xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:block">
          <nav
            aria-label="On this page"
            className="sticky top-[calc(var(--header-height)+1.5rem)] max-h-[calc(100dvh-var(--header-height)-3rem)] overflow-y-auto overscroll-contain p-1"
          >
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-subtle">On this page</p>
            <TableOfContents nodes={outline} />
          </nav>
        </aside>
      )}

      <div className="min-w-0 xl:col-start-1">
        {children}
        {footer}
      </div>
    </main>
  );
}
