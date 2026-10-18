"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import {
  removeBookmark,
  resolvePlace,
  studyHref,
  studyPageIndex,
  type ResolvedPlace,
  type StudyPageInfo,
  type StudyPlace,
} from "@/lib/study";
import { studyStore, useStudy } from "@/components/use-study";

// "Continue studying" and the saved bookmarks, at the top of the dashboard.
// They live in this browser's localStorage, so this part renders in the
// browser; the server sends the same frame with a short loading line.
type Props = { pages: StudyPageInfo[] }; // every study page: current titles and anchors

export default function StudyShelf({ pages }: Props) {
  const { ready, saved, data } = useStudy();
  const index = useMemo(() => studyPageIndex(pages), [pages]);
  const bookmarksHeading = useRef<HTMLHeadingElement>(null);

  // Checked against the pages and sections that exist now. A missing page is
  // skipped; a missing section links to its page instead.
  const lastVisit = data.lastVisit && resolvePlace(data.lastVisit, index);
  const bookmarks = data.bookmarks.flatMap((saved) => {
    const shown = resolvePlace(saved, index);
    return shown ? [{ saved, shown }] : [];
  });

  function remove(place: StudyPlace) {
    studyStore.update((d) => removeBookmark(d, place));
    // The button is gone, so keep focus nearby
    bookmarksHeading.current?.focus();
  }

  return (
    <section aria-labelledby="study-heading" className="mt-10">
      <h2 id="study-heading" className="sr-only">Your study</h2>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {/* The card stands out when there's somewhere to go back to */}
        <div
          className={
            "rounded-card border p-5 " +
            (ready && lastVisit ? "border-accent/40 bg-surface-raised" : "border-border bg-surface")
          }
          aria-busy={!ready}
        >
          <h3
            className={
              "text-xs font-medium uppercase tracking-[0.08em] " + (ready && lastVisit ? "text-accent-text" : "text-subtle")
            }
          >
            Continue studying
          </h3>
          {!ready ? (
            <Loading />
          ) : lastVisit ? (
            <ResumeLink place={lastVisit} />
          ) : (
            <p className="mt-2 text-sm text-muted">Open any chapter, kana, kanji or document page to pick up from here later.</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col rounded-card border border-border bg-surface p-5" aria-busy={!ready}>
          <h3
            ref={bookmarksHeading}
            tabIndex={-1}
            className="self-start rounded-control text-xs font-medium uppercase tracking-[0.08em] text-subtle"
          >
            Bookmarks{ready && bookmarks.length > 0 && <span className="normal-case tracking-normal"> ({bookmarks.length})</span>}
          </h3>
          {!ready ? (
            <Loading />
          ) : bookmarks.length ? (
            // A long list scrolls inside the card; every row stays reachable with Tab
            <ul className="-mx-2 mt-2 max-h-[19rem] divide-y divide-border overflow-y-auto overscroll-contain">
              {bookmarks.map(({ saved, shown }) => {
                const name = shown.section ?? shown.title;
                return (
                  // Keyed and removed by what's saved, even when it's shown as the whole page
                  <li key={studyHref(saved)} className="flex items-center gap-1 py-1">
                    <BookmarkLink place={shown} />
                    <button
                      type="button"
                      onClick={() => remove(saved)}
                      aria-label={`Remove bookmark: ${name}`}
                      className="min-h-10 shrink-0 rounded-control px-3 text-sm text-subtle transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-offset-[-2px]"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No bookmarks yet. Use Bookmark page on any study page, or Bookmark section after jumping to one.
            </p>
          )}
        </div>
      </div>
      {ready && !saved && (
        <p className="mt-2 text-sm text-subtle">
          This browser isn&apos;t letting the site save, so bookmarks and your last page last until you close this tab.
        </p>
      )}
    </section>
  );
}

function Loading() {
  return <p className="mt-2 text-sm text-subtle">Loading your saved pages…</p>;
}

function MissingSection() {
  return <span className="mt-1 block text-xs text-subtle">The saved section is no longer on this page, so this opens the page.</span>;
}

// The last place studied: page label, its real title, the section when it
// still exists, and a clear Resume. The whole card is one link.
function ResumeLink({ place }: { place: ResolvedPlace }) {
  return (
    <Link
      href={place.href}
      className="group mt-3 flex flex-col gap-4 rounded-control sm:flex-row sm:items-end sm:justify-between"
    >
      <span className="min-w-0">
        <span className="block text-sm text-muted">{place.label}</span>
        <span className="mt-0.5 block break-words text-xl font-semibold leading-snug text-foreground">{place.title}</span>
        {place.section && (
          <span className="mt-1 block break-words text-sm text-muted">
            <span className="text-subtle">Section: </span>
            {place.section}
          </span>
        )}
        {place.sectionMissing && <MissingSection />}
      </span>
      <span className="inline-flex min-h-10 shrink-0 items-center gap-1.5 self-start rounded-control bg-accent px-4 text-sm font-medium text-background transition-opacity group-hover:opacity-90 sm:self-auto">
        Resume
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5" />
        </svg>
      </span>
    </Link>
  );
}

// "Chapter 3 · Copula Sentences" over "Vocabulary" for a section,
// "Chapter 3" over "Copula Sentences" for a whole page
function BookmarkLink({ place }: { place: ResolvedPlace }) {
  return (
    <Link
      href={place.href}
      className="min-w-0 flex-1 rounded-control px-2 py-2 transition-colors hover:bg-surface-raised focus-visible:outline-offset-[-2px]"
    >
      <span className="block break-words text-xs text-subtle">
        {place.section ? `${place.label} · ${place.title}` : place.label}
      </span>
      <span className="block break-words font-medium text-foreground">{place.section ?? place.title}</span>
      {place.sectionMissing && <MissingSection />}
    </Link>
  );
}
