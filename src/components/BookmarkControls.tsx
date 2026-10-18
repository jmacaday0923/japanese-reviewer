"use client";

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { isBookmarked, recordVisit, toggleBookmark, type StudyPageKind } from "@/lib/study";
import type { TocNode } from "@/lib/toc";
import { studyStore, useStudy } from "@/components/use-study";

// The bookmark buttons under a reader page's title. This is the page's only
// client code: the title, outline and lesson content around it stay server
// rendered. It also remembers the page as the last one studied.
type Props = {
  kind: StudyPageKind;
  id: string;
  outline: TocNode[]; // the page's "On this page" links: the sections that can be bookmarked
};

// The #section in the address bar. Outline links are plain hash links, so
// "hashchange" covers clicks and Back/Forward between sections.
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash.slice(1);
const noHash = () => "";

function sectionLabels(nodes: TocNode[], map = new Map<string, string>()) {
  for (const node of nodes) {
    map.set(node.id, node.label);
    sectionLabels(node.children, map);
  }
  return map;
}

export default function BookmarkControls({ kind, id, outline }: Props) {
  const { ready, saved, data } = useStudy();
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);
  const labels = useMemo(() => sectionLabels(outline), [outline]);

  // Only a heading from this page's outline counts as a section
  const section = hash ? labels.get(hash) : undefined;
  const anchor = section === undefined ? null : hash;
  const label = section ?? null;

  useEffect(() => {
    studyStore.update((d) => recordVisit(d, { kind, id, anchor, section: label }, Date.now()));
  }, [kind, id, anchor, label]);

  const page = { kind, id, anchor: null, section: null };
  const here = anchor ? { kind, id, anchor, section: label } : null;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <ToggleButton
          pressed={isBookmarked(data, page)}
          disabled={!ready}
          onClick={() => studyStore.update((d) => toggleBookmark(d, page, Date.now()))}
        >
          Bookmark page
        </ToggleButton>
        {here && (
          <ToggleButton
            pressed={isBookmarked(data, here)}
            disabled={!ready}
            onClick={() => studyStore.update((d) => toggleBookmark(d, here, Date.now()))}
          >
            Bookmark section: {label}
          </ToggleButton>
        )}
      </div>
      {ready && !saved && (
        <p className="mt-2 text-sm text-subtle">
          This browser isn&apos;t letting the site save, so bookmarks last until you close this tab.
        </p>
      )}
    </div>
  );
}

// Quiet outlined buttons, so they stay secondary to the title above them
function ToggleButton({ pressed, disabled, onClick, children }: {
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={
        "inline-flex min-h-10 max-w-full items-center gap-2 rounded-control border px-3 text-left text-sm break-words transition-colors disabled:opacity-60 " +
        (pressed
          ? "border-accent/50 bg-accent-soft text-accent-text"
          : "border-border text-muted hover:border-border-strong hover:text-foreground")
      }
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" fill={pressed ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="size-4 shrink-0">
        <path d="M5.5 3.5h9a.5.5 0 0 1 .5.5v12.6a.3.3 0 0 1-.48.24L10 13.5l-4.52 3.34A.3.3 0 0 1 5 16.6V4a.5.5 0 0 1 .5-.5z" />
      </svg>
      <span className="min-w-0">{children}</span>
    </button>
  );
}
