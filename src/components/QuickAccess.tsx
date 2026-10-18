const LINKS = [
  { href: "#chapters", label: "Chapters" },
  { href: "#kana", label: "Kana" },
  { href: "#kanji", label: "Kanji" },
  { href: "#documents", label: "Documents" },
];

// Small jump links to the sections further down this page
export default function QuickAccess() {
  return (
    <nav aria-labelledby="quick-access-heading" className="-mx-2 flex flex-wrap items-center gap-x-1 lg:mx-0">
      {/* Phones have room for the links on one line only without the label */}
      <h2 id="quick-access-heading" className="mr-1 text-xs font-medium uppercase tracking-[0.08em] text-subtle max-sm:sr-only">
        Jump to
      </h2>
      <ul className="flex flex-wrap">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {l.label}
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-subtle max-sm:hidden">
                <path d="M10 4.5v11m-4.5-4.5L10 15.5l4.5-4.5" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
