import { splitReadingContent } from "@/lib/reading-content";
import ReadingTable from "@/components/ReadingTable";

// Preserve trusted lesson HTML and heading IDs; render hint-bearing tables as React.
type Props = { html: string; as?: "div" | "article"; className?: string };

export default function LessonContent({ html, as: Tag = "div", className }: Props) {
  const blocks = splitReadingContent(html);
  return (
    <Tag className={className ? "lesson " + className : "lesson"}>
      {blocks.map((block, i) => block.type === "table"
        ? <ReadingTable key={i} table={block.table} />
        : <div key={i} className="reading-html" dangerouslySetInnerHTML={{ __html: block.html }} />)}
    </Tag>
  );
}
