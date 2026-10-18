// Small line icons on a 20px grid, all drawn with the same stroke so they
// read as one set. Decorative: the text next to each icon carries the meaning.
const PATHS = {
  home: "M3.5 9 10 3.75 16.5 9v6.75a.75.75 0 0 1-.75.75H12.5V12h-5v4.5H4.25a.75.75 0 0 1-.75-.75Z",
  chapters: "M4 4.75A1.75 1.75 0 0 1 5.75 3H16v11.5H5.75A1.75 1.75 0 0 0 4 16.25Zm0 11.5A1.75 1.75 0 0 0 5.75 18H16",
  // a character with its reading beside it
  kana: "M3.5 5.5h7M7 3.5v2M5 5.5c.25 3 1.75 5.25 4.5 6.5M9 5.5C8.5 8.5 6.75 10.75 3.75 12M11.25 17l2.75-6.5 2.75 6.5m-4.6-2h3.7",
  // a writing-practice square, as in genkō yōshi paper
  kanji: "M3.75 3.75h12.5v12.5H3.75ZM10 3.75v12.5M3.75 10h12.5",
  // a sheet of exam questions with check marks
  practice: "M5.75 3h8.5a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75V3.75A.75.75 0 0 1 5.75 3ZM7.5 7l1 1 2-2M7.5 12l1 1 2-2M12 7h1M12 12h1",
  bookmark: "M6 3.5h8a.75.75 0 0 1 .75.75V16.5L10 13.25 5.25 16.5V4.25A.75.75 0 0 1 6 3.5Z",
  // an open book
  book: "M10 5.5C8.5 4.25 6.25 3.75 3.25 4v11c3-.25 5.25.25 6.75 1.5 1.5-1.25 3.75-1.75 6.75-1.5V4c-3-.25-5.25.25-6.75 1.5Zm0 0v11",
  search: "M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM13.75 13.75 17.5 17.5",
  arrow: "M4.5 10h11m-4.5-4.5L15.5 10 11 14.5",
  chevron: "M8 5.5 12.5 10 8 14.5",
  "chevron-down": "M6 8l4 4 4-4",
  close: "M5.5 5.5l9 9M14.5 5.5l-9 9",
  check: "M4.5 10.5 8 14l7.5-8",
  retry: "M4.5 10a5.5 5.5 0 1 0 1.6-3.9M4.5 3.75v2.5H7",
  menu: "M3.5 6h13M3.5 10h13M3.5 14h13",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
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
