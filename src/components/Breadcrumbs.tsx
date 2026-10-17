import Link from "next/link";

export type Crumb = { label: string; href?: string }; // no href: the current page

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-x-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-subtle">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="rounded-control transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="min-w-0 break-words text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
