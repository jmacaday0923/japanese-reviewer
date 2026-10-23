import CheckpointText from "@/components/CheckpointText";
import book from "@/data/furigana.json";
import { furiganaPage, furiganaParts, type FuriganaBook } from "@/lib/furigana";

// Book-style readings above each kanji word, for pages listed in furigana.json.
export default function Furigana({ text, scope }: { text: string; scope: string }) {
  const page = furiganaPage(book as FuriganaBook, scope);
  return page ? <CheckpointText text={text} parts={furiganaParts(text, page)} /> : <>{text}</>;
}
