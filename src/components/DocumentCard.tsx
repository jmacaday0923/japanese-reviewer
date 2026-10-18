import Link from "next/link";
import type { Doc } from "@/types/lesson";
import Icon from "@/components/Icon";

// One row of the document library: kind, title, date when there is one, and
// an arrow. Missing kind or date simply leaves that part out.
export default function DocumentCard({ doc }: { doc: Doc }) {
  return (
    <Link
      href={`/lessons/${doc.n}`}
      className="group flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised focus-visible:outline-offset-[-2px]"
    >
      <span className="min-w-0 flex-1">
        {(doc.kind || doc.date) && (
          <span className="block text-xs text-subtle">
            {doc.kind && <span className="font-medium uppercase tracking-[0.08em]">{doc.kind}</span>}
            {/* On phones the date sits here; wider screens show it on the right */}
            {doc.date && (
              <span className="sm:hidden">
                {doc.kind && " · "}
                {doc.date}
              </span>
            )}
          </span>
        )}
        <span className="mt-0.5 block break-words font-medium text-foreground">{doc.title}</span>
      </span>
      {doc.date && <span className="hidden shrink-0 text-sm tabular-nums text-subtle sm:block">{doc.date}</span>}
      <Icon name="arrow" className="size-4 text-subtle transition-colors group-hover:text-accent-text" />
    </Link>
  );
}
