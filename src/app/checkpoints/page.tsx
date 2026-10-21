import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import CheckpointShelf from "@/components/CheckpointShelf";
export const metadata: Metadata = { title: "Course checkpoints" };
export default function CheckpointsPage() {
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkpoints" }]} />
    <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-accent-text">After Chapters 5 and 10</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Course checkpoints</h1>
    <p className="mt-3 max-w-2xl leading-relaxed text-muted">After Chapter 5, take one 54-question vocabulary-and-reading checkpoint covering Chapters 1–5. After Chapter 10, take separate 40-question vocabulary and grammar exams: in each, 28 focus on Chapters 6–10 and 12 revisit Chapters 1–5.</p>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">Answer in Japanese without romaji or translation hints. Submit to see explanations, chapter results and links back to your lessons. Original course practice inspired by JLPT question formats; scores are raw marks.</p>
    <CheckpointShelf />
  </main>;
}
