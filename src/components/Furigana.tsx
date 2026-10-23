import CheckpointText from "@/components/CheckpointText";
import book from "@/data/furigana.json";
import { furiganaPage, furiganaParts, type FuriganaBook } from "@/lib/furigana";

// Book-style readings above each kanji word, for pages listed in furigana.json.
// Study pages are strict, so a missing reading fails the build. Saved flashcards
// may hold older text, so they fall back to plain text instead.
export default function Furigana({ text, scope, strict = true }: { text: string; scope: string; strict?: boolean }) {
  const page = furiganaPage(book as FuriganaBook, scope);
  if (!page) return <>{text}</>;
  let parts;
  try { parts = furiganaParts(text, page); } catch (error) { if (strict) throw error; return <>{text}</>; }
  return <CheckpointText text={text} parts={parts} />;
}
