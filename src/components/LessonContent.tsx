import { splitReadingContent, type ReadingBlock } from "@/lib/reading-content";
import { lastFlashcardHeading, tableFlashcards, type FlashcardContext } from "@/lib/flashcard-content";
import type { FlashcardDraft, FlashcardExample } from "@/lib/flashcards";
import ReadingTable from "@/components/ReadingTable";

// Preserve trusted lesson HTML and heading IDs; enrich eligible table rows on the server.
type Props = { html: string; as?: "div" | "article"; className?: string; source?: FlashcardContext; examples?: FlashcardExample[] };
export default function LessonContent({ html, as: Tag = "div", className, source, examples = [] }: Props) {
  let heading = { id: source?.sectionId ?? "", title: source?.sectionTitle ?? "" };
  const blocks: { block: ReadingBlock; flashcards?: (FlashcardDraft | null)[] }[] = [];
  for (const block of splitReadingContent(html)) {
    if (block.type === "html") heading = lastFlashcardHeading(block.html, heading);
    blocks.push({ block, flashcards: block.type === "table" && source ? tableFlashcards(block.table, source, heading, examples) : undefined });
  }
  return (
    <Tag className={className ? "lesson " + className : "lesson"}>
      {blocks.map(({ block, flashcards }, i) => block.type === "table"
        ? <ReadingTable key={i} table={block.table} flashcards={flashcards} />
        : <div key={i} className="reading-html" dangerouslySetInnerHTML={{ __html: block.html }} />)}
    </Tag>
  );
}
