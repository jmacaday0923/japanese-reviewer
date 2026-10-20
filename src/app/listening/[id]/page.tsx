import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ListeningExam from "@/components/ListeningExam";
import { getListeningExam, listeningExams } from "@/lib/listening-data";
export const instant = false;
export function generateStaticParams() { return listeningExams.map(exam => ({ id: exam.id })); }
export default async function ListeningExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = getListeningExam(id);
  if (!exam) notFound();
  return <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Listening", href: "/listening" }, { label: exam.title }]} />
    <p className="mt-8 text-xs font-medium uppercase tracking-wider text-accent-text">Listening practice</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{exam.title}</h1>
    <p className="mt-3 text-muted">{exam.description} Audio includes the original instructions and worked examples.</p>
    <ListeningExam exam={exam} />
  </main>;
}
