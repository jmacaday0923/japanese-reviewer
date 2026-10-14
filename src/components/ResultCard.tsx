import { Fragment } from "react";
import type { Doc, Item } from "@/types/lesson";

type Props = { item: Item; doc?: Doc };

export default function ResultCard({ item, doc }: Props) {
  // Where it came from: document title, then section
  const where = [doc?.title, item.b].filter(Boolean).join(" › ");

  return (
    <li className="rounded-lg bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500">{where}</p>

      {item.t === "r" ? (
        // Table row: show each column with its header
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {item.x.split(" | ").map((value, i) =>
            value.trim() ? (
              <Fragment key={i}>
                <dt className="text-sm text-neutral-500">{item.hd[i]}</dt>
                <dd>{value}</dd>
              </Fragment>
            ) : null
          )}
        </dl>
      ) : (
        // Paragraph or list point
        <p className="mt-1">{item.x}</p>
      )}
    </li>
  );
}