"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { pageKey, removeBookmark, studyHref, type StudyPageInfo, type StudyPlace } from "@/lib/study";
import { studyStore, useStudy } from "@/components/use-study";

// "Continue studying" and the saved bookmarks, at the top of the dashboard.
// They live in this browser's localStorage, so this part renders in the
// browser; the server sends the same frame with a short loading line.
type Props = { pages: StudyPageInfo[] }; // every study page, for current titles

export default function StudyShelf({ pages }: Props) {
  const { ready, saved, data } = useStudy();
  const byKey = useMemo(() => new Map(pages.map((p) => [p.key, p])), [pages]);
  const bookmarksHeading = useRef<HTMLHeadingElement>(null);

  // Places on pages that no longer exist are skipped, not shown as broken links
  const lastVisit = data.lastVisit && byKey.has(pageKey(data.lastVisit)) ? data.lastVisit : null;
  const bookmarks = data.bookmarks.filter((b) => byKey.has(pageKey(b)));

  function remove(place: StudyPlace) {
    studyStore.update((d) => removeBookmark(d, place));
    // The button is gone, so keep focus nearby
    bookmarksHeading.current?.focus();
  }

  return (
    <section aria-labelledby="study-heading" className="mt-8">
      <h2 id="study-heading" className="sr-only">Your study</h2>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-card border border-border bg-surface p-4" aria-busy={!ready}>
          <h3 className="text-sm font-medium uppercase tracking-wide text-subtle">Continue studying</h3>
          {!ready ? (
            <Loading />
          ) : lastVisit ? (
            <PlaceLink place={lastVisit} info={byKey.get(pageKey(lastVisit))!} className="mt-3" />
          ) : (
            <p className="mt-3 text-sm text-muted">
              Open any chapter, kana, kanji or document page and it shows up here, so you can pick up where you left off.
            </p>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-4" aria-busy={!ready}>
          <h3 ref={bookmarksHeading} tabIndex={-1} className="rounded-control text-sm font-medium uppercase tracking-wide text-subtle">
            Bookmarks{ready && bookmarks.length > 0 && <span className="normal-case tracking-normal"> ({bookmarks.length})</span>}
          </h3>
          {!ready ? (
            <Loading />
          ) : bookmarks.length ? (
            <ul className="mt-3 space-y-2">
              {bookmarks.map((b) => {
                const info = byKey.get(pageKey(b))!;
                const name = b.section ?? info.title;
                return (
                  <li key={studyHref(b)} className="flex items-start gap-2">
                    <PlaceLink place={b} info={info} className="min-w-0 flex-1" />
                    <button
                      type="button"
                      onClick={() => remove(b)}
                      aria-label={`Remove bookmark: ${name}`}
                      className="min-h-10 shrink-0 rounded-control px-3 text-sm text-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No bookmarks yet. Use Bookmark page on any chapter, kana, kanji or document page. After you jump to a section from On this page, you can bookmark that section too.
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
  return <p className="mt-3 text-sm text-subtle">Loading your saved pages…</p>;
}

// "Chapter 3 · Copula Sentences" over "Vocabulary" for a section,
// "Chapter 3" over "Copula Sentences" for a whole page
function PlaceLink({ place, info, className }: { place: StudyPlace; info: StudyPageInfo; className: string }) {
  return (
    <Link
      href={studyHref(place)}
      className={`${className} flex flex-col rounded-control border border-border bg-background px-3 py-2 transition-colors hover:border-border-strong hover:bg-surface-raised`}
    >
      <span className="text-xs text-subtle break-words">
        {place.section ? `${info.label} · ${info.title}` : info.label}
      </span>
      <span className="font-medium text-foreground break-words">{place.section ?? info.title}</span>
    </Link>
  );
}
