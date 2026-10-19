import { cellText, cellKind, furiganaPair, type ReadingTableData } from "@/lib/reading-content";
import { ReadingFurigana, ReadingHint } from "@/components/ReadingPreferences";

// Server-rendered table; only individual hints and ruby readings are interactive.
export default function ReadingTable({ table }: { table: ReadingTableData }) {
  return (
    <div className="tw">
      <table>
        <thead><tr>{table.headers.map((header, c) => <th key={c} scope="col" dangerouslySetInnerHTML={{ __html: header }} />)}</tr></thead>
        <tbody>
          {table.rows.map((row, r) => {
            const pair = furiganaPair(table.headers, row);
            const context = cellText(row[0] ?? "") || "row " + (r + 1);
            return (
              <tr key={r}>
                {row.map((html, c) => {
                  const kind = cellKind(table.headers, row, c);
                  const value = <span dangerouslySetInnerHTML={{ __html: html }} />;
                  return (
                    <td key={c}>
                      {pair?.column === c ? <ReadingFurigana word={pair.word} reading={pair.reading} />
                        : kind && cellText(html) ? <ReadingHint kind={kind} context={context}>{value}</ReadingHint>
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
