import { Fragment } from "react";
import Link from "next/link";
import { resultHref, type SearchEntry, type SearchPage } from "@/lib/search";
import { columnKind, cellKind, rowLabel } from "@/lib/reading-content";
import { ReadingHint } from "@/components/ReadingPreferences";
import CategoryTag from "@/components/CategoryTag";

type Props = { entry: SearchEntry; pages: SearchPage[]; header?: string[]; showCategory?: boolean };
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

export default function ResultCard({ entry, pages, header, showCategory = false }: Props) {
  const where = [pages[entry.p].name, entry.b].filter(Boolean).join(" › ");
  const vocab = vocabularyColumns(entry, header);
  const values = entry.x.split(" | ");
  const context = rowLabel(header ?? [], values, where);

  return (
    <li className="relative rounded-card border border-border bg-background px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent-text">
      {/* One stretched link; reveal buttons are siblings, never nested inside it. */}
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
                {vocab.japanese.map((spelling, i) => {
                  const kind = cellKind(header!, values, spelling.column);
                  return (
                    <Fragment key={spelling.column}>
                      {i > 0 && " "}
                      <span>{kind ? <ReadingHint kind={kind} context={context}>{spelling.value}</ReadingHint> : spelling.value}</span>
                    </Fragment>
                  );
                })}
              </span>
            )}
            {vocab.values[1]?.trim() && (
              <span className="text-sm text-accent-text"><ReadingHint kind="romaji" context={context}>{vocab.values[1]}</ReadingHint></span>
            )}
          </p>
          {vocab.values[2]?.trim() && (
            <p className="mt-0.5 break-words text-muted"><ReadingHint kind="english" context={context}>{vocab.values[2]}</ReadingHint></p>
          )}
          {vocab.values.length > 3 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {vocab.values.slice(3).map((value, i) => value.trim() ? (
                <div key={i} className="flex gap-1.5">
                  <dt className="text-subtle">{vocab.extraHeaders[i]}</dt>
                  <dd className="min-w-0 break-words text-muted">
                    {columnKind(vocab.extraHeaders[i])
                      ? <ReadingHint kind={columnKind(vocab.extraHeaders[i])!} context={context}>{value}</ReadingHint>
                      : value}
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
            const kind = cellKind(header, values, i);
            return (
              <Fragment key={i}>
                <dt className="text-sm text-subtle">{header[i]}</dt>
                <dd className="min-w-0 break-words">
                  {kind ? <ReadingHint kind={kind} context={context}>{value}</ReadingHint> : value}
                </dd>
              </Fragment>
            );
          })}
        </dl>
      ) : <p className="mt-1.5 break-words leading-relaxed">{entry.x}</p>}
    </li>
  );
}
