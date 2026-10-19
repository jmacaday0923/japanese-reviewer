import { splitReadingContent } from "@/lib/reading-content";
import { sectionFlashcards, type FlashcardContext } from "@/lib/flashcard-content";
import type { FlashcardExample } from "@/lib/flashcards";
import ReadingTable from "@/components/ReadingTable";

// Preserve trusted lesson HTML and heading IDs; enrich eligible table rows on the server.
type Props = { html: string; as?: "div" | "article"; className?: string; source?: FlashcardContext; examples?: FlashcardExample[] };
export default function LessonContent({ html, as: Tag = "div", className, source, examples = [] }: Props) {
  const blocks = sectionFlashcards(splitReadingContent(html), source, examples);
  return (
    <Tag className={className ? "lesson " + className : "lesson"}>
      {blocks.map(({ block, flashcards }, i) => block.type === "table"
        ? <ReadingTable key={i} table={block.table} flashcards={flashcards} />
        : <div key={i} className="reading-html" dangerouslySetInnerHTML={{ __html: block.html }} />)}
    </Tag>
  );
}
