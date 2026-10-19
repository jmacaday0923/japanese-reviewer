import { Fragment } from "react";
import Link from "next/link";
import { resultHref, type SearchEntry, type SearchPage } from "@/lib/search";
import { rowLabel } from "@/lib/reading-content";
import CategoryTag from "@/components/CategoryTag";

type Props = { entry: SearchEntry; pages: SearchPage[]; header?: string[]; showCategory?: boolean; occurrences?: SearchEntry[] };
const JAPANESE = ["Kana", "Japanese", "Word", "Kanji"];

function vocabularyColumns(entry: SearchEntry, header: string[] | undefined) {
  if ((entry.c !== "vocab" && entry.c !== "script") || !header || !JAPANESE.includes(header[0])) return null;
  const spellings = JAPANESE.includes(header[1]) ? 2 : 1;
  if (header[spellings] !== "Romaji" || header[spellings + 1] !== "English") return null;
  const values = entry.x.split(" | ");
  const word = [...new Set(values.slice(0, spellings).map((v) => v.trim()).filter(Boolean))].join(" ");
  const japanese = values.slice(0, spellings)
    .map((value, column) => ({ value: value.trim(), column }))
    .filter((spelling, i, all) => spelling.value && all.findIndex((item) => item.value === spelling.value) === i);
  return { values: [word, ...values.slice(spellings)], japanese, extraHeaders: header.slice(spellings + 2) };
}

export default function ResultCard({ entry, pages, header, showCategory = false, occurrences = [] }: Props) {
  const where = [pages[entry.p].name, entry.b].filter(Boolean).join(" › ");
  const vocab = vocabularyColumns(entry, header);
  const values = entry.x.split(" | ");
  const context = rowLabel(header ?? [], values, where);
  const primaryHref = resultHref(entry, pages);
  const seen = new Set([primaryHref]);
  const otherLocations = occurrences.filter((other) => {
    const href = resultHref(other, pages);
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });

  return (
    <li data-search-result="" className="relative rounded-card border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent-text">
      {/* One stretched primary link; additional locations stay separate. */}
      <div className="flex items-start justify-between gap-3">
        <Link href={resultHref(entry, pages)} aria-label={vocab ? context + " — " + where : undefined}
          className="min-w-0 break-words text-xs leading-relaxed text-subtle after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
          {where}
        </Link>
        {showCategory && <CategoryTag category={entry.c} />}
      </div>

      {vocab ? (
        <div className="mt-1.5">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {vocab.values[0]?.trim() && (
              <span lang="ja" className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-medium text-foreground">
                {vocab.japanese.map((spelling, i) => (
                  <Fragment key={spelling.column}>
                    {i > 0 && " "}
                    <span>{spelling.value}</span>
                  </Fragment>
                ))}
              </span>
            )}
            {vocab.values[1]?.trim() && (
              <span className="text-sm text-accent-text">{vocab.values[1]}</span>
            )}
          </p>
          {vocab.values[2]?.trim() && (
            <p className="mt-0.5 break-words text-muted">{vocab.values[2]}</p>
          )}
          {vocab.values.length > 3 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {vocab.values.slice(3).map((value, i) => value.trim() ? (
                <div key={i} className="flex gap-1.5">
                  <dt className="text-subtle">{vocab.extraHeaders[i]}</dt>
                  <dd className="min-w-0 break-words text-muted">
                    {value}
                  </dd>
                </div>
              ) : null)}
            </dl>
          )}
        </div>
      ) : header ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          {values.map((value, i) => {
            if (!value.trim()) return null;
            return (
              <Fragment key={i}>
                <dt className="text-sm text-subtle">{header[i]}</dt>
                <dd className="min-w-0 break-words">
                  {value}
                </dd>
              </Fragment>
            );
          })}
        </dl>
      ) : <p className="mt-1.5 break-words leading-relaxed">{entry.x}</p>}

      {otherLocations.length > 0 && (
        <details className="relative z-10 mt-3 border-t border-border pt-2">
          <summary className="min-h-11 cursor-pointer rounded-control px-1 py-3 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent-text">
            Also in {otherLocations.length} other {otherLocations.length === 1 ? "location" : "locations"}
          </summary>
          <div className="flex flex-col gap-1 pb-1">
            {otherLocations.map((other) => (
              <Link key={resultHref(other, pages)} href={resultHref(other, pages)} prefetch={false}
                className="min-h-11 rounded-control px-3 py-2.5 text-sm leading-relaxed text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-text">
                {[pages[other.p].name, other.b].filter(Boolean).join(" › ")}
              </Link>
            ))}
          </div>
        </details>
      )}
    </li>
  );
}
