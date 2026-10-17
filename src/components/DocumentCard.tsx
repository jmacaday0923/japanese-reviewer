import Link from "next/link";
import type { Doc } from "@/types/lesson";

export default function DocumentCard({ doc }: { doc: Doc }) {
  // Kind and date when the data has them; nothing at all when both are empty
  const meta = [doc.kind, doc.date].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/lessons/${doc.n}`}
      className="flex h-full flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      {meta && <span className="text-xs text-subtle">{meta}</span>}
      <span className={`${meta ? "mt-1 " : ""}font-medium text-foreground`}>{doc.title}</span>
    </Link>
  );
}
