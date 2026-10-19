import { cellText, cellKind, isExampleTable, isJapaneseColumn, rowLabel, type ReadingTableData } from "@/lib/reading-content";
import type { FlashcardDraft } from "@/lib/flashcards";
import StudyHtml from "@/components/StudyHtml";
import AddAllFlashcards from "@/components/AddAllFlashcards";
import AddFlashcard from "@/components/AddFlashcard";
import { ReadingHint } from "@/components/ReadingPreferences";

// One table at every width keeps per-item reveals and flashcard controls intact.
export default function ReadingTable({ table, flashcards = [], scope = "" }: { table: ReadingTableData; flashcards?: (FlashcardDraft | null)[]; scope?: string }) {
  const hasFlashcards = flashcards.some(Boolean);
  const examples = isExampleTable(table);
  return (
    <div className={examples ? "tw reading-examples" : "tw"}>
      {/* Explicit roles retain table semantics when the mobile CSS changes display. */}
      <table role={examples ? "table" : undefined}>
        {examples && <caption className="sr-only">Japanese examples</caption>}
        <thead role={examples ? "rowgroup" : undefined}>
          <tr role={examples ? "row" : undefined}>
            {table.headers.map((header, c) => (
              <th key={c} role={examples ? "columnheader" : undefined} scope="col" className="reading-column-heading" ><StudyHtml html={header} scope={scope} /></th>
            ))}
            {hasFlashcards && (
              <th role={examples ? "columnheader" : undefined} scope="col" className="reading-actions">
                <AddAllFlashcards drafts={flashcards.filter((draft): draft is FlashcardDraft => draft !== null)} />
              </th>
            )}
          </tr>
        </thead>
        <tbody role={examples ? "rowgroup" : undefined}>
          {table.rows.map((row, r) => {
            const context = rowLabel(table.headers, row, "row " + (r + 1));
            return (
              <tr key={r} role={examples ? "row" : undefined}>
                {row.map((html, c) => {
                  const kind = cellKind(table.headers, row, c);
                  const japanese = isJapaneseColumn(table.headers[c]);
                  const value = <span lang={japanese || kind === "kana" ? "ja" : kind === "english" ? "en" : undefined}
                    className={kind === "kana" ? "reading-kana" : japanese ? "reading-japanese" : kind ? "reading-supporting" : undefined}
                    ><StudyHtml html={html} scope={scope} literal={kind === "romaji"} english={kind === "english"} /></span>;
                  return (
                    <td key={c} role={examples ? "cell" : undefined}>
                      {examples && <span aria-hidden="true" className="reading-cell-label">{cellText(table.headers[c])}</span>}
                      {kind && cellText(html) ? <ReadingHint kind={kind} context={context}>{value}</ReadingHint> : value}
                    </td>
                  );
                })}
                {hasFlashcards && <td role={examples ? "cell" : undefined}>{flashcards[r] && <AddFlashcard draft={flashcards[r]!} />}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
