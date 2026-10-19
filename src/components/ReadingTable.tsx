import { cellText, cellKind, rowLabel, type ReadingTableData } from "@/lib/reading-content";
import { ReadingHint } from "@/components/ReadingPreferences";

// Render Japanese spellings as plain text, with independent reading hints.
// No readings are generated above kanji.
export default function ReadingTable({ table }: { table: ReadingTableData }) {
  return (
    <div className="tw">
      <table>
        <thead><tr>{table.headers.map((header, c) => <th key={c} scope="col" dangerouslySetInnerHTML={{ __html: header }} />)}</tr></thead>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
