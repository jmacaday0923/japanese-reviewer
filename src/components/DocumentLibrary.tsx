import type { DocumentSummary } from "@/lib/documents";
import DocumentCard, { ROW_COLUMNS } from "@/components/DocumentCard";

// Every source document as a compact row, in the order the data file lists
// them. Wide screens get aligned columns with headings; phones stack each row.
export default function DocumentLibrary({ docs }: { docs: DocumentSummary[] }) {
  return (
    <section id="documents" aria-labelledby="documents-heading" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="documents-heading" className="text-xl font-semibold tracking-tight text-foreground">Documents</h2>
        <p className="text-sm text-subtle">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        The original reviewers, vocabulary lists, answer keys and extras. These are what the search looks through.
      </p>
      <div className="mt-5 overflow-hidden rounded-card border border-border bg-surface">
        {/* Visual column headings only: every row already says what each part is */}
        <div
          aria-hidden="true"
          className={`hidden border-b border-border px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle md:grid ${ROW_COLUMNS}`}
        >
          <span className="pl-9">Name</span>
          <span>Content</span>
          <span>Date</span>
        </div>
        <ul className="divide-y divide-border">
          {docs.map((doc) => (
            <li key={doc.n}>
              <DocumentCard doc={doc} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
