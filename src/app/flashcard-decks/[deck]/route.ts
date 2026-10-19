import { getFlashcardDeck, getFlashcardDeckInfos } from "@/lib/flashcard-decks";

export function generateStaticParams() {
  return getFlashcardDeckInfos().map((info) => ({ deck: info.slug }));
}
// Cache Components can prerender these known decks. There is no user data here.
export async function GET(_request: Request, { params }: { params: Promise<{ deck: string }> }) {
  const { deck: slug } = await params;
  const deck = getFlashcardDeck(slug);
  return deck ? Response.json(deck) : Response.json({ error: "Deck not found" }, { status: 404 });
}
