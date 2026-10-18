"use client";

import type { StudyPageKind } from "@/lib/study";
import { useStudy } from "@/components/use-study";

// "Last opened" on the card of the page Continue studying points to. It
// comes from this browser's saved study state, so it renders only in the
// browser: nothing in the server HTML, nothing while loading. The card
// highlights itself with CSS when this badge is inside it.
export default function LastOpenedBadge({ kind, id }: { kind: StudyPageKind; id: string }) {
  const { ready, data } = useStudy();
  const last = data.lastVisit;
  if (!ready || !last || last.kind !== kind || last.id !== id) return null;
  return (
    <span
      data-last-opened=""
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-accent-text"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-text" />
      Last opened
    </span>
  );
}
