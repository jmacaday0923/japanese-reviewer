import Link from "next/link";
import Icon from "@/components/Icon";
import { checkpointExams } from "@/lib/checkpoint-data";
import { checkpointCoverage, checkpointQuestions } from "@/lib/checkpoints";

export default function CheckpointShelf() {
  const stages = [...new Set(checkpointExams.map(exam => checkpointCoverage(exam).afterChapter))].sort((a, b) => Number(a) - Number(b));
  return <section id="checkpoints" aria-labelledby="checkpoints-heading" className="mt-10">
    <span id="practice" className="block" />
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="checkpoints-heading" className="text-xl font-semibold tracking-tight">Checkpoints</h2>
      <Link href="/checkpoints" className="inline-flex min-h-11 items-center gap-2 text-sm text-accent-text">Browse checkpoints <Icon name="arrow" className="size-4" /></Link>
    </div>
    <p className="mt-1 text-sm leading-relaxed text-muted">Check your progress after Chapters 5 and 10. Submit an assessment, review explanations, then retry mistakes.</p>
    {stages.map(stage => <div key={stage} className="mt-6">
      <h3 className="text-sm font-semibold text-muted">After Chapter {stage}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {checkpointExams.filter(exam => checkpointCoverage(exam).afterChapter === stage).map(exam => <Link key={exam.id} href={"/checkpoints/" + exam.id} className="rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-raised">
          <div className="flex items-center gap-3"><Icon name="practice" className="size-6 text-accent-text" /><h4 className="font-semibold">{exam.title}</h4></div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{exam.cardDescription}</p>
          <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle"><span>{checkpointQuestions(exam).length} questions · {checkpointCoverage(exam).label} · Untimed</span><Icon name="arrow" className="size-4 text-accent-text" /></p>
        </Link>)}
      </div>
    </div>)}
  </section>;
}
