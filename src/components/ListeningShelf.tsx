import Link from "next/link";
import Icon from "@/components/Icon";
import { listeningExams } from "@/lib/listening-data";
export default function ListeningShelf() {
  return (
    <section id="listening" aria-labelledby="listening-heading" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="listening-heading" className="text-xl font-semibold tracking-tight">Listening</h2>
        <Link href="/listening" className="inline-flex min-h-11 items-center gap-2 text-sm text-accent-text">Browse listening exams <Icon name="arrow" className="size-4" /></Link>
      </div>
      <p className="mt-1 text-sm text-muted">Listen, choose your answers, and review the clues you heard.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {listeningExams.map(exam => <Link key={exam.id} href={`/listening/${exam.id}`} className="group rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-raised">
          <div className="flex items-center gap-3"><Icon name="headphones" className="size-6 text-accent-text" /><h3 className="font-semibold">{exam.title}</h3></div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{exam.description}</p>
          <p className="mt-4 flex items-center justify-between text-xs text-subtle"><span>{exam.sections.length} parts · About 30 minutes</span><Icon name="arrow" className="size-4 text-accent-text" /></p>
        </Link>)}
      </div>
    </section>
  );
}
