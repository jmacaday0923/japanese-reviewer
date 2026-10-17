import { Fragment } from "react";
import Link from "next/link";
import { lessonHref, type SearchEntry } from "@/lib/search";

type Props = {
  entry: SearchEntry;
  docTitle?: string;
  header?: string[]; // column headers, for table rows
  badge?: string;    // optional label, like the category
};

export default function ResultCard({ entry, docTitle, header, badge }: Props) {
  // Where it came from: document title, then section
  const where = [docTitle, entry.b].filter(Boolean).join(" › ");

  return (
    <li>
      <Link
        href={lessonHref(entry)}
        className="block rounded-card border border-border bg-background p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-xs text-subtle">{where}</p>
          {badge && (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">{badge}</span>
          )}
        </div>

        {header ? (
          // Table row: show each column with its header
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            {entry.x.split(" | ").map((value, i) =>
              value.trim() ? (
                <Fragment key={i}>
                  <dt className="text-sm text-subtle">{header[i]}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </Fragment>
              ) : null
            )}
          </dl>
        ) : (
          // Paragraph or list point
          <p className="mt-1 break-words">{entry.x}</p>
        )}
      </Link>
    </li>
  );
}
