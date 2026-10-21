import { splitReadingContent } from "@/lib/reading-content";
import { sectionFlashcards, type FlashcardContext } from "@/lib/flashcard-content";
import type { FlashcardExample } from "@/lib/flashcards";
import StudyHtml from "@/components/StudyHtml";
import ReadingTable from "@/components/ReadingTable";
import type { LegacyActivity } from "@/lib/legacy-exercises";

// Preserve trusted lesson HTML and heading IDs; enrich eligible table rows on the server.
type Props = { html: string; as?: "div" | "article"; className?: string; source?: FlashcardContext; examples?: FlashcardExample[]; activities?: LegacyActivity[] };
export default function LessonContent({ html, as: Tag = "div", className, source, examples = [], activities = [] }: Props) {
  const scope = source ? `${source.kind}/${source.id}/${source.sectionId}` : "";
  const blocks = sectionFlashcards(splitReadingContent(html), source, examples);
  return (
    <Tag className={className ? "lesson " + className : "lesson"}>
      {blocks.map(({ block, flashcards }, i) => block.type === "table"
        ? <ReadingTable key={i} table={block.table} flashcards={flashcards} scope={scope} />
        : <div key={i} className="reading-html"><StudyHtml html={block.html} scope={scope} activities={activities} /></div>)}
    </Tag>
  );
}
