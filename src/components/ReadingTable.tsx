import { cellText, cellKind, rowLabel, type ReadingTableData } from "@/lib/reading-content";
import type { FlashcardDraft } from "@/lib/flashcards";
import AddAllFlashcards from "@/components/AddAllFlashcards";
import AddFlashcard from "@/components/AddFlashcard";
import { ReadingHint } from "@/components/ReadingPreferences";

// Render Japanese spellings as plain text, with independent reading hints.
// No readings are generated above kanji.
export default function ReadingTable({ table, flashcards = [] }: { table: ReadingTableData; flashcards?: (FlashcardDraft | null)[] }) {
  const hasFlashcards = flashcards.some(Boolean);
  return (
    <div className="tw">
      <table>
        <thead><tr>{table.headers.map((header, c) => <th key={c} scope="col" dangerouslySetInnerHTML={{ __html: header }} />)}{hasFlashcards && <th scope="col"><AddAllFlashcards drafts={flashcards.filter((draft): draft is FlashcardDraft => draft !== null)} /></th>}</tr></thead>
        <tbody>
          {table.rows.map((row, r) => {
            const context = rowLabel(table.headers, row, "row " + (r + 1));
            return (
              <tr key={r}>
                {row.map((html, c) => {
                  const kind = cellKind(table.headers, row, c);
                  const value = <span dangerouslySetInnerHTML={{ __html: html }} />;
                  return (
                    <td key={c}>
                      {kind && cellText(html) ? <ReadingHint kind={kind} context={context}>{value}</ReadingHint>
                        : value}
                    </td>
                  );
                })}
                {hasFlashcards && <td>{flashcards[r] && <AddFlashcard draft={flashcards[r]!} />}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
