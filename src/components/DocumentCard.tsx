import Link from "next/link";
import { chapterSummary, type DocumentSummary } from "@/lib/documents";
import CategoryTag from "@/components/CategoryTag";
import Icon from "@/components/Icon";

// Shared with the column headings in DocumentLibrary, so they line up
export const ROW_COLUMNS = "md:grid-cols-[minmax(0,1fr)_16.5rem_6.5rem_1rem] md:items-center md:gap-x-4";

// One row of the document library: icon, title with its source type and
// chapters, content tags, date when there is one, and an arrow. Only the
// title is a link (a short link name); its ::after covers the whole row.
export default function DocumentCard({ doc }: { doc: DocumentSummary }) {
  const chapters = chapterSummary(doc.chapters);
  // "Reviewer · Chapters 1 to 5"; "Kana" alone when both say the same
  const source = [doc.kind, chapters !== doc.kind ? chapters : ""].filter(Boolean).join(" · ");

  return (
    <div
      className={`group relative grid grid-cols-[minmax(0,1fr)_1rem] items-start gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-surface-raised has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-accent-text md:min-h-14 ${ROW_COLUMNS}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon name="documents" className="mt-0.5 size-[1.125rem] text-subtle" />
        <div className="min-w-0">
          <Link
            href={`/lessons/${doc.n}`}
            className="block break-words text-sm font-medium leading-snug text-foreground after:absolute after:inset-0 focus-visible:outline-none"
          >
            {doc.title}
          </Link>
          {(source || doc.date) && (
            <p className="mt-0.5 text-xs text-subtle">
              {source}
              {/* On phones the date joins this line; wider screens give it a column */}
              {doc.date && (
                <span className="md:hidden">
                  {source && " · "}
                  {doc.date}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* On phones the tags sit under the title */}
      <div className="col-start-1 flex flex-wrap items-center gap-1.5 pl-[1.875rem] md:col-start-auto md:pl-0">
        {doc.categories.map((c) => (
          <CategoryTag key={c} category={c} />
        ))}
      </div>
      <p className="hidden text-sm tabular-nums text-subtle md:block">{doc.date}</p>

      <Icon
        name="arrow"
        className="col-start-2 row-start-1 mt-0.5 size-4 text-subtle transition-colors group-hover:text-accent-text md:col-start-auto md:row-start-auto md:mt-0"
      />
    </div>
  );
}
