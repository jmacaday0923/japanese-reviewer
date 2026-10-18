"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { NAV_ITEMS } from "@/components/nav-items";
import Icon from "@/components/Icon";

// The main navigation links, shared by the sidebar and the phone menu. This
// is the only part of the navigation that needs the browser: it reads which
// top-level section the current page is in, to mark that link as current.
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

function NavList({ size, onNavigate, current }: Props & { current: string | null | undefined }) {
  return (
    <ul className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const active = current !== undefined && item.segment === current;
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
                  ? "bg-surface-raised font-medium text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                  : "text-muted hover:bg-surface hover:text-foreground")
              }
            >
              <Icon name={item.icon} className={"size-[1.125rem] " + (active ? "text-accent-text" : "text-subtle")} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
