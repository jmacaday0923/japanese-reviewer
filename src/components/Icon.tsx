import type { NavIcon } from "@/components/nav-items";

// Small line icons on a 20px grid, all drawn with the same stroke so they
// read as one set. Decorative: the text next to each icon carries the meaning.
const PATHS: Record<NavIcon | "search" | "arrow", string> = {
  home: "M3.5 9 10 3.75 16.5 9v6.75a.75.75 0 0 1-.75.75H12.5V12h-5v4.5H4.25a.75.75 0 0 1-.75-.75Z",
  chapters: "M4 4.75A1.75 1.75 0 0 1 5.75 3H16v11.5H5.75A1.75 1.75 0 0 0 4 16.25Zm0 11.5A1.75 1.75 0 0 0 5.75 18H16",
  // a character with its reading beside it
  kana: "M3.5 5.5h7M7 3.5v2M5 5.5c.25 3 1.75 5.25 4.5 6.5M9 5.5C8.5 8.5 6.75 10.75 3.75 12M11.25 17l2.75-6.5 2.75 6.5m-4.6-2h3.7",
  // a writing-practice square, as in genkō yōshi paper
  kanji: "M3.75 3.75h12.5v12.5H3.75ZM10 3.75v12.5M3.75 10h12.5",
  documents: "M6 3h5.75L15.5 6.75V16.25a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75V3.75A.75.75 0 0 1 6 3Zm5.5 0v4h4M8 10.5h5M8 13.5h3.5",
  search: "M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM13.75 13.75 17.5 17.5",
  arrow: "M4.5 10h11m-4.5-4.5L15.5 10 11 14.5",
};

export default function Icon({ name, className = "size-5" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
