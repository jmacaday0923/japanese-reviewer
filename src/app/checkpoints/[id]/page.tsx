import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import CheckpointExam from "@/components/CheckpointExam";
import { checkpointCoverage } from "@/lib/checkpoints";
import { checkpointExams, getCheckpointExam } from "@/lib/checkpoint-data";
export const instant = false;
export function generateStaticParams() { return checkpointExams.map(exam => ({ id: exam.id })); }
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const exam = getCheckpointExam((await params).id);
  return { title: exam?.title ?? "Checkpoint not found" };
}
export default async function CheckpointPage({ params }: Props) {
  const exam = getCheckpointExam((await params).id);
  if (!exam) notFound();
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkpoints", href: "/checkpoints" }, { label: exam.title }]} />
    <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-accent-text">After Chapter {checkpointCoverage(exam).afterChapter} · {checkpointCoverage(exam).label}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{exam.title}</h1>
    <p className="mt-3 text-muted">{exam.description} Answers and explanations appear after submission.</p>
    <CheckpointExam key={exam.id} exam={exam} />
  </main>;
}
