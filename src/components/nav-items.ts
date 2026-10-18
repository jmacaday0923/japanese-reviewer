// Where the navigation can take you: real pages and home page sections.
// `segment` is the first part of the path that belongs to each item, so the
// reader pages can mark their group as current: /chapters/3 is in Chapters,
// /lessons/2 is in Documents. Home is current only on "/" itself.
export type NavIcon = "home" | "chapters" | "kana" | "kanji" | "documents";

export const NAV_ITEMS: { href: string; label: string; icon: NavIcon; segment: string | null }[] = [
  { href: "/", label: "Home", icon: "home", segment: null },
  { href: "/#chapters", label: "Chapters", icon: "chapters", segment: "chapters" },
  { href: "/#kana", label: "Kana", icon: "kana", segment: "kana" },
  { href: "/#kanji", label: "Kanji", icon: "kanji", segment: "kanji" },
  { href: "/#documents", label: "Documents", icon: "documents", segment: "lessons" },
];
