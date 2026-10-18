import type { Doc } from "@/types/lesson";
import DocumentCard from "@/components/DocumentCard";

// Every source document as a compact row, in the order the data file lists them
export default function DocumentLibrary({ docs }: { docs: Doc[] }) {
  return (
    <section id="documents" aria-labelledby="documents-heading" className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="documents-heading" className="text-xl font-semibold tracking-tight">All documents</h2>
        <p className="text-sm text-subtle">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        The original reviewers, vocabulary lists, answer keys and extras. These are what the search looks through.
      </p>
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {docs.map((doc) => (
          <li key={doc.n}>
            <DocumentCard doc={doc} />
          </li>
        ))}
      </ul>
    </section>
  );
}
