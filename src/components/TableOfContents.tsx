import type { TocNode } from "@/lib/toc";

// The outline as nested lists of ordinary hash links. Top-level links are
// always visible; the headings under each one sit in a closed disclosure,
// so a 118-entry outline shows as a handful of sections. No ids are used,
// so the same outline can appear twice (phone and desktop) safely.
export default function TableOfContents({ nodes }: { nodes: TocNode[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {nodes.map((node) => (
        <TocItem key={node.id} node={node} />
      ))}
    </ul>
  );
}

function TocItem({ node }: { node: TocNode }) {
  const count = node.children.length;
  return (
    <li className="min-w-0">
      <a
        href={`#${node.id}`}
        className="block rounded-control px-2 py-1.5 break-words text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        {node.label}
      </a>
      {count > 0 && (
        <details className="group">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-control px-2 text-xs text-subtle transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 transition-transform group-open:rotate-90">
              <path d="M8 6l4 4-4 4" />
            </svg>
            {count} {count === 1 ? "topic" : "topics"}
            <span className="sr-only"> in {node.label}</span>
          </summary>
          <ul className="mb-1 ml-3 space-y-0.5 border-l border-border pl-2">
            {node.children.map((child) => (
              <TocItem key={child.id} node={child} />
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
