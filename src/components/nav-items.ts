import type { IconName } from "@/components/Icon";

// Where the navigation can take you: real pages and home page sections,
// in the groups the sidebar and the phone menu show.
// `segment` is the first part of the path that belongs to each item, so the
// reader pages can mark their group as current: /chapters/3 is in Chapters,
// The former /practice/1 is now a Checkpoints alias. Home is current only on "/" itself (null).
// false means the item is never marked current: Bookmarks is a section of
// the home page, not a place of its own.
export type NavItem = { href: string; label: string; icon: IconName; segment: string | null | false };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Study",
    items: [
      { href: "/", label: "Home", icon: "home", segment: null },
      { href: "/#chapters", label: "Chapters", icon: "chapters", segment: "chapters" },
      { href: "/#kana", label: "Kana", icon: "kana", segment: "kana" },
      { href: "/#kanji", label: "Kanji", icon: "kanji", segment: "kanji" },
      { href: "/listening", label: "Listening", icon: "headphones", segment: "listening" },
      { href: "/checkpoints", label: "Checkpoints", icon: "practice", segment: "checkpoints" },
      { href: "/cheat-sheets", label: "Cheat sheets", icon: "sheet", segment: "cheat-sheets" },
    ],
  },
  {
    label: "Saved",
    items: [
      { href: "/#bookmarks", label: "Bookmarks", icon: "bookmark", segment: false },
      { href: "/flashcards", label: "Flashcards", icon: "book", segment: "flashcards" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
