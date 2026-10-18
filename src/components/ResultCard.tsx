import { Fragment } from "react";
import Link from "next/link";
import { resultHref, type SearchEntry, type SearchPage } from "@/lib/search";
import CategoryTag from "@/components/CategoryTag";

type Props = {
  entry: SearchEntry;
  pages: SearchPage[]; // every study page, for the entry's link and page name
  header?: string[]; // column headers, for table rows
  showCategory?: boolean; // the category tag, when results aren't already filtered to one
};

const JAPANESE = ["Kana", "Japanese", "Word", "Kanji"];

// Word lists (on chapter, kana and kanji pages) whose columns are the word,
// sometimes a second spelling (kana and kanji), its romaji and its meaning
// get a word-first layout: [word, romaji, meaning, ...extra columns], with
// the extra columns' headers. Every other table keeps the generic one.
function vocabularyColumns(entry: SearchEntry, header: string[] | undefined) {
  if ((entry.c !== "vocab" && entry.c !== "script") || !header || !JAPANESE.includes(header[0])) return null;
  const spellings = JAPANESE.includes(header[1]) ? 2 : 1;
  if (header[spellings] !== "Romaji" || header[spellings + 1] !== "English") return null;
  const values = entry.x.split(" | ");
  // "のる 乗る": both spellings when there are two, without repeats or blanks
  const word = [...new Set(values.slice(0, spellings).map((v) => v.trim()).filter(Boolean))].join(" ");
  return {
    values: [word, ...values.slice(spellings)],
    extraHeaders: header.slice(spellings + 2),
  };
}

export default function ResultCard({ entry, pages, header, showCategory = false }: Props) {
  // Where it is: the page, then the section and heading on it
  const where = [pages[entry.p].name, entry.b].filter(Boolean).join(" › ");
  const vocab = vocabularyColumns(entry, header);

  return (
    <li>
      <Link
        href={resultHref(entry, pages)}
        className="block rounded-card border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-xs leading-relaxed text-subtle">{where}</p>
          {showCategory && <CategoryTag category={entry.c} />}
        </div>

        {vocab ? (
          // Vocabulary: the Japanese word first, romaji beside it, the meaning below
          <div className="mt-1.5">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {vocab.values[0]?.trim() && (
                <span lang="ja" className="text-xl font-medium text-foreground">{vocab.values[0]}</span>
              )}
              {vocab.values[1]?.trim() && <span className="text-sm text-accent-text">{vocab.values[1]}</span>}
            </p>
            {vocab.values[2]?.trim() && <p className="mt-0.5 break-words text-muted">{vocab.values[2]}</p>}
            {/* Any extra columns (like Group or Type), small and labeled */}
            {vocab.values.length > 3 && (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {vocab.values.slice(3).map((value, i) =>
                  value.trim() ? (
                    <div key={i} className="flex gap-1.5">
                      <dt className="text-subtle">{vocab.extraHeaders[i]}</dt>
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
