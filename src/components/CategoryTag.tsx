import { categoryLabel } from "@/lib/search";
import type { Category } from "@/lib/documents";

// Written out in full so Tailwind finds every class when it scans the source.
// The label always names the category, so the color is only a second cue.
const STYLES: Record<Category, string> = {
  grammar: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  vocab: "border-green-400/25 bg-green-400/10 text-green-300",
  script: "border-purple-400/25 bg-purple-400/10 text-purple-300",
  practice: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  answers: "border-rose-400/25 bg-rose-400/10 text-rose-300",
};

// A small colored label for a content category: Grammar, Vocabulary,
// Kana & Kanji, Practice or Answers. No hooks, so server and client
// components can both use it.
export default function CategoryTag({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-4 ${STYLES[category]}`}
    >
      {categoryLabel(category)}
    </span>
  );
}
