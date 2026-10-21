import guides from "@/data/chapter-guides.json";

// Course guidance only. The source chapter HTML, anchors and assessment banks
// remain authoritative and retain their existing IDs.
export default function ChapterStudyPlan({ chapter, questions }: { chapter: string; questions: number }) {
  const guide = guides.chapters.find(item => item.chapter === chapter);
  if (!guide) return null;
  const heading = "chapter-" + chapter + "-study-plan";
  return <aside aria-labelledby={heading} className="mt-8 rounded-card border border-border bg-surface p-4 sm:p-5" data-chapter-study-plan={chapter}>
    <h2 id={heading} className="text-lg font-semibold">Study plan</h2>
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
      {guide.goals.map(goal => <li key={goal}>{goal}</li>)}
    </ul>
    {guide.note && <p className="mt-4 rounded-control border border-border p-3 text-sm leading-relaxed text-muted">{guide.note}</p>}
    <nav aria-label="Chapter study steps" className="mt-4 flex flex-wrap gap-2">
      {[["lessons", "Study lessons"], ["vocab", "Review vocabulary"], ["mixups", "Common mix-ups"], ["exercises", "Practise"], ["answers", "Compare answers"]].map(([id, label]) => (
        <a key={id} href={"#" + id} className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-3 text-sm text-accent-text hover:bg-surface-raised">{label}</a>
      ))}
    </nav>
    <p className="mt-3 text-xs leading-relaxed text-subtle">{questions} workbook and review questions. Start with the examples, try the exercises, then use the explanations to review.</p>
  </aside>;
}
