// Server-only bank, derived from the same verified rows as the lesson buttons.
import "server-only";
import chapters from "@/data/chapters.json";
import kana from "@/data/kana.json";
import kanji from "@/data/kanji.json";
import { splitReadingContent } from "@/lib/reading-content";
import { collectFlashcardExamples, sectionFlashcards } from "@/lib/flashcard-content";
import { flashcardId, type FlashcardDeck, type FlashcardDeckInfo, type FlashcardDraft } from "@/lib/flashcards";

const groups = [{ kind: "chapter", label: "Chapter", pages: chapters }, { kind: "kana", label: "Kana", pages: kana }, { kind: "kanji", label: "Kanji", pages: kanji }] as const;
let bank: { info: FlashcardDeckInfo; deck: FlashcardDeck }[] | undefined;
function getBank() {
  bank ??= groups.flatMap(({ kind, label, pages }) => pages.map((page) => {
    const examples = collectFlashcardExamples(page.sections, { kind, id: page.ch });
    const drafts: FlashcardDraft[] = [];
    for (const section of page.sections) {
      const context = { kind, id: page.ch, sectionId: section.id, sectionTitle: section.title };
      for (const item of sectionFlashcards(splitReadingContent(section.html), context, examples)) {
        drafts.push(...(item.flashcards ?? []).filter((draft): draft is FlashcardDraft => draft !== null));
      }
    }
    const key = kind + ":" + page.ch, slug = kind + "-" + page.ch;
    const count = (items: FlashcardDraft[]) => new Set(items.map(flashcardId)).size;
    const decks: { info: FlashcardDeckInfo; deck: FlashcardDeck }[] = [{ info: { key, slug, label: label + " " + page.ch, title: page.title, count: count(drafts) },
      deck: { version: 1 as const, key, drafts } }];
    // Chapters also get a words-only deck without the lesson sentences. Its cards are the
    // same cards as the full deck's, so adding both never duplicates a card or its history.
    const words = drafts.filter((draft) => draft.kind === "vocabulary");
    if (kind === "chapter" && words.length) decks.push({
      info: { key, slug: slug + "-vocabulary", label: label + " " + page.ch + " vocabulary", title: page.title, count: count(words), vocabularyOnly: true },
      deck: { version: 1 as const, key, drafts: words } });
    return decks;
  })).flat();
  return bank;
}
export const getFlashcardDeckInfos = (): FlashcardDeckInfo[] => getBank().map((item) => item.info);
export const getFlashcardDeck = (slug: string): FlashcardDeck | undefined => getBank().find((item) => item.info.slug === slug)?.deck;
