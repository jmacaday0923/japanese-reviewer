// Lesson HTML from the local data files, with the shared .lesson styles.
// The HTML is inserted exactly as it is, so heading ids, tables, exercises
// and answer keys stay the same and every anchor keeps working.
type Props = {
  html: string;
  as?: "div" | "article";
  className?: string;
};

export default function LessonContent({ html, as: Tag = "div", className }: Props) {
  // Trusted: the HTML comes from this project's own JSON, not from users
  return <Tag className={className ? `lesson ${className}` : "lesson"} dangerouslySetInnerHTML={{ __html: html }} />;
}
