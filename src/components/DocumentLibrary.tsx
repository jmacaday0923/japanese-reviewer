import type { Doc } from "@/types/lesson";
import DocumentCard from "@/components/DocumentCard";

// Every source document, in the order the data file lists them
export default function DocumentLibrary({ docs }: { docs: Doc[] }) {
  return (
    <section id="documents" aria-labelledby="documents-heading" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="documents-heading" className="text-xl font-semibold">All documents</h2>
        <p className="text-sm text-subtle">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        The original reviewers, vocabulary lists, answer keys and extras. These are what the search looks through.
      </p>
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-3">
        {docs.map((doc) => (
          <li key={doc.n}>
            <DocumentCard doc={doc} />
          </li>
        ))}
      </ul>
    </section>
  );
}
