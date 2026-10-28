import type { Metadata } from "next";
import Link from "next/link";
import { getFlashcardDeckInfos } from "@/lib/flashcard-decks";
import { familiarKanji } from "@/lib/flashcard-face";
import kanji from "@/data/kanji.json";
import FlashcardDashboard from "@/components/FlashcardDashboard";
export const metadata: Metadata = { title: "Flashcards" };
export default function FlashcardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent-text hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Flashcards</h1>
      <p className="mt-3 text-muted">Choose a pre-made deck or save your own cards from lessons. Cards and review progress are saved in this browser.</p>
      <FlashcardDashboard decks={getFlashcardDeckInfos()} familiarKanji={familiarKanji(kanji)} />
    </main>
  );
}
