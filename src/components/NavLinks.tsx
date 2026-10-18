"use client";

import { Suspense, useId } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "@/components/nav-items";
import Icon from "@/components/Icon";

// The main navigation links, shared by the sidebar and the phone menu, plus
// the "where am I" label in the toolbar. This is the only part of the shell
// that needs the browser: it reads which top-level section the current page
// is in, to mark that link as current.
type Props = {
  size: "sidebar" | "menu";
  onNavigate?: () => void; // the phone menu closes itself when a link is chosen
};

export default function NavLinks(props: Props) {
  // A page whose address isn't known while building (such as /chapters/99)
  // can't tell which link is current until it's requested, so the plain
  // list stands in. Every known page resolves it while building.
  return (
    <Suspense fallback={<NavList {...props} current={undefined} />}>
      <CurrentNavList {...props} />
    </Suspense>
  );
}

function CurrentNavList(props: Props) {
  // "chapters" on /chapters/3, null on the home page
  const segment = useSelectedLayoutSegment();
  return <NavList {...props} current={segment} />;
}

function isCurrent(item: NavItem, current: string | null | undefined) {
  return current !== undefined && item.segment !== false && item.segment === current;
}

function NavList({ size, onNavigate, current }: Props & { current: string | null | undefined }) {
  const id = useId();
  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group, g) => (
        <div key={group.label}>
          <p id={`${id}-${g}`} className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle">
            {group.label}
          </p>
          <ul aria-labelledby={`${id}-${g}`} className="space-y-0.5">
            {group.items.map((item) => {
              const active = isCurrent(item, current);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    // "page" on the home page itself; "true" for the group a reader page belongs to
                    aria-current={active ? (item.segment === null ? "page" : "true") : undefined}
                    className={
                      "relative flex items-center gap-3 rounded-control px-3 transition-colors " +
                      (size === "menu" ? "min-h-12 text-base " : "min-h-10 text-sm ") +
                      (active
                        ? "bg-accent-soft font-medium text-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
                        : "text-muted hover:bg-surface-raised hover:text-foreground")
                    }
                  >
                    <Icon name={item.icon} className={"size-[1.125rem] " + (active ? "text-accent-text" : "text-subtle")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// The toolbar's quiet "you are here": Home, Chapters, Kana, Kanji or
// Documents with its icon. Plain text, not a link; nothing while unknown.
export function NavLocation() {
  return (
    <Suspense fallback={null}>
      <CurrentLocation />
    </Suspense>
  );
}

function CurrentLocation() {
  const segment = useSelectedLayoutSegment();
  const item = NAV_ITEMS.find((i) => i.segment !== false && i.segment === segment);
  if (!item) return null;
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Icon name={item.icon} className="size-[1.125rem] text-muted" />
      {item.label}
    </p>
  );
}
