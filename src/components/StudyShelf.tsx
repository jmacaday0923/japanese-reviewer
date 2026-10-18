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
  type StudyPageKind,
  type StudyPlace,
} from "@/lib/study";
import { studyStore, useStudy } from "@/components/use-study";
import Icon, { type IconName } from "@/components/Icon";

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
    <section aria-labelledby="study-heading" className="mt-8">
      <h2 id="study-heading" className="sr-only">Your study</h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="rounded-card border border-border bg-surface p-5 sm:p-6" aria-busy={!ready}>
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle">Continue studying</h3>
          {!ready ? (
            <Loading />
          ) : lastVisit ? (
            <ResumeLink place={lastVisit} />
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Open any chapter, kana, kanji or document page to pick up from here later.
            </p>
          )}
        </div>

        {/* #bookmarks is where the sidebar's Saved link lands */}
        <div id="bookmarks" className="flex min-w-0 flex-col rounded-card border border-border bg-surface p-5" aria-busy={!ready}>
          <h3
            ref={bookmarksHeading}
            tabIndex={-1}
            className="flex items-center gap-2 self-start rounded-control text-lg font-semibold tracking-tight text-foreground"
          >
            <Icon name="bookmark" className="size-5 text-accent-text" />
            Bookmarks{ready && bookmarks.length > 0 && <span className="font-normal text-muted"> ({bookmarks.length})</span>}
          </h3>
          {!ready ? (
            <Loading />
          ) : bookmarks.length ? (
            // A long list scrolls inside the card; every row stays reachable with Tab
            <ul className="-mx-1 mt-3 max-h-[17.5rem] space-y-2 overflow-y-auto overscroll-contain px-1 py-0.5">
              {bookmarks.map(({ saved, shown }) => {
                const name = shown.section ?? shown.title;
                return (
                  // Keyed and removed by what's saved, even when it's shown as the whole page
                  <li key={studyHref(saved)} className="flex items-center gap-1">
                    <BookmarkLink place={shown} kind={saved.kind} />
                    <button
                      type="button"
                      onClick={() => remove(saved)}
                      aria-label={`Remove bookmark: ${name}`}
                      title="Remove bookmark"
                      className="flex size-10 shrink-0 items-center justify-center rounded-control text-subtle transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-[-2px]"
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">
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

const KIND_ICONS: Record<StudyPageKind, IconName> = {
  chapter: "chapters",
  kana: "kana",
  kanji: "kanji",
  lesson: "documents",
};

function Loading() {
  return <p className="mt-2 text-sm text-subtle">Loading your saved pages…</p>;
}

function MissingSection() {
  return <span className="mt-1 block text-xs text-subtle">The saved section is no longer on this page, so this opens the page.</span>;
}

// The last place studied: its real title, the page label and section when it
// still exists, and a clear Resume button. The whole card is one link.
function ResumeLink({ place }: { place: ResolvedPlace }) {
  return (
    <Link href={place.href} className="group mt-2 flex items-start justify-between gap-6 rounded-control">
      <span className="min-w-0">
        <span className="block break-words text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
          {place.title}
        </span>
        <span className="mt-1.5 block break-words text-muted">
          {place.label}
          {place.section && (
            <>
              <span aria-hidden="true" className="px-2 text-subtle">·</span>
              <span className="sr-only">, section: </span>
              {place.section}
            </>
          )}
        </span>
        {place.sectionMissing && <MissingSection />}
        <span className="mt-4 block text-sm text-muted">Pick up where you left off.</span>
        <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-5 text-[0.9375rem] font-medium text-accent-foreground transition-colors group-hover:bg-accent-hover">
          Resume lesson
          <Icon name="arrow" className="size-4" />
        </span>
      </span>
      {/* Decorative */}
      <span className="hidden size-20 shrink-0 items-center justify-center rounded-card border border-border bg-surface-raised text-muted sm:flex">
        <Icon name="book" className="size-9" />
      </span>
    </Link>
  );
}

// "Vocabulary" over "Kana 1 · Hiragana and Katakana" for a section,
// "Copula Sentences" over "Chapter 1" for a whole page
function BookmarkLink({ place, kind }: { place: ResolvedPlace; kind: StudyPageKind }) {
  return (
    <Link
      href={place.href}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-control border border-border bg-background/50 px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:outline-offset-[-2px]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-raised text-accent-text">
        <Icon name={KIND_ICONS[kind]} className="size-[1.125rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-foreground">{place.section ?? place.title}</span>
        <span className="mt-0.5 block break-words text-xs text-subtle">
          {place.section ? `${place.label} · ${place.title}` : place.label}
        </span>
        {place.sectionMissing && <MissingSection />}
      </span>
      <Icon name="chevron" className="size-4 text-subtle transition-colors group-hover:text-foreground" />
    </Link>
  );
}
