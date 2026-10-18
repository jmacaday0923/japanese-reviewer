import type { IconName } from "@/components/Icon";

// Where the navigation can take you: real pages and home page sections,
// in the groups the sidebar and the phone menu show.
// `segment` is the first part of the path that belongs to each item, so the
// reader pages can mark their group as current: /chapters/3 is in Chapters,
// /lessons/2 is in Documents. Home is current only on "/" itself (null).
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
      { href: "/#documents", label: "Documents", icon: "documents", segment: "lessons" },
    ],
  },
  {
    label: "Saved",
    items: [{ href: "/#bookmarks", label: "Bookmarks", icon: "bookmark", segment: false }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
