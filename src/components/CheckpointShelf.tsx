import Link from "next/link";
import Icon from "@/components/Icon";
import { checkpointExams } from "@/lib/checkpoint-data";
export default function CheckpointShelf() {
  return <section id="checkpoints" aria-labelledby="checkpoints-heading" className="mt-10">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="checkpoints-heading" className="text-xl font-semibold tracking-tight">Chapter 10 checkpoints</h2>
      <Link href="/checkpoints" className="inline-flex min-h-11 items-center gap-2 text-sm text-accent-text">Browse checkpoints <Icon name="arrow" className="size-4" /></Link>
    </div>
    <p className="mt-1 text-sm leading-relaxed text-muted">Finished Chapter 10? Assess vocabulary and grammar across the course, with most questions focused on Chapters 6–10.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {checkpointExams.map(exam => <Link key={exam.id} href={"/checkpoints/" + exam.id} className="rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-raised">
        <div className="flex items-center gap-3"><Icon name="practice" className="size-6 text-accent-text" /><h3 className="font-semibold">{exam.title}</h3></div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{exam.id === "vocabulary" ? "Kanji readings, written forms, words in context and similar meanings." : "Grammar choices, sentence composition and short text grammar."}</p>
        <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle"><span>40 questions · Untimed · Saved in this browser</span><Icon name="arrow" className="size-4 text-accent-text" /></p>
      </Link>)}
    </div>
  </section>;
}
