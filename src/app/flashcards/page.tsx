import type { Metadata } from "next";
import Link from "next/link";
import FlashcardDashboard from "@/components/FlashcardDashboard";
export const metadata: Metadata = { title: "Flashcards" };
export default function FlashcardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent-text hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Flashcards</h1>
      <p className="mt-3 text-muted">Save useful words and sentences, then review what’s due. Your deck is saved in this browser.</p>
      <FlashcardDashboard />
    </main>
  );
}
