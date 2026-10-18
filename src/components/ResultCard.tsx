import { Fragment } from "react";
import Link from "next/link";
import { lessonHref, type SearchEntry } from "@/lib/search";

type Props = {
  entry: SearchEntry;
  docTitle?: string;
  header?: string[]; // column headers, for table rows
  badge?: string;    // optional label, like the category
};

// Vocabulary rows whose first three columns are the word, its romaji and its
// meaning get a word-first layout. Every other table keeps the generic one.
function vocabularyColumns(entry: SearchEntry, header: string[] | undefined) {
  if (entry.c !== "vocab" || !header) return null;
  const [japanese, romaji, english] = header;
  if (!(japanese === "Kana" || japanese === "Japanese") || romaji !== "Romaji" || english !== "English") return null;
  return entry.x.split(" | ");
}

export default function ResultCard({ entry, docTitle, header, badge }: Props) {
  // Where it came from: document title, then section
  const where = [docTitle, entry.b].filter(Boolean).join(" › ");
  const vocab = vocabularyColumns(entry, header);

  return (
    <li>
      <Link
        href={lessonHref(entry)}
        className="block rounded-card border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-xs leading-relaxed text-subtle">{where}</p>
          {badge && (
            <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">{badge}</span>
          )}
        </div>

        {vocab && header ? (
          // Vocabulary: the Japanese word first, romaji beside it, the meaning below
          <div className="mt-1.5">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {vocab[0]?.trim() && (
                <span lang="ja" className="text-xl font-medium text-foreground">{vocab[0]}</span>
              )}
              {vocab[1]?.trim() && <span className="text-sm text-accent-text">{vocab[1]}</span>}
            </p>
            {vocab[2]?.trim() && <p className="mt-0.5 break-words text-muted">{vocab[2]}</p>}
            {/* Any extra columns (like Group or Type), small and labeled */}
            {vocab.length > 3 && (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {vocab.slice(3).map((value, i) =>
                  value.trim() ? (
                    <div key={i} className="flex gap-1.5">
                      <dt className="text-subtle">{header[i + 3]}</dt>
                      <dd className="min-w-0 break-words text-muted">{value}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            )}
          </div>
        ) : header ? (
          // Other table rows: show each column with its header
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
          <p className="mt-1.5 break-words leading-relaxed">{entry.x}</p>
        )}
      </Link>
    </li>
  );
}
