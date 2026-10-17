import { Fragment } from "react";
import Link from "next/link";
import type { Doc, Item } from "@/types/lesson";

type Props = { item: Item; doc?: Doc };

export default function ResultCard({ item, doc }: Props) {
  // Where it came from: document title, then section
  const where = [doc?.title, item.b].filter(Boolean).join(" › ");

  // Lesson page URL, jumping to the section the item sits in (if it has one)
  const href = `/lessons/${item.d}${item.a ? `#${item.a}` : ""}`;

  return (
    <li>
      <Link
        href={href}
        className="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        <p className="text-xs text-subtle">{where}</p>

        {item.t === "r" ? (
          // Table row: show each column with its header
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            {item.x.split(" | ").map((value, i) =>
              value.trim() ? (
                <Fragment key={i}>
                  <dt className="text-sm text-subtle">{item.hd[i]}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </Fragment>
              ) : null
            )}
          </dl>
        ) : (
          // Paragraph or list point
          <p className="mt-1 break-words">{item.x}</p>
        )}
      </Link>
    </li>
  );
}
