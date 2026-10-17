const LINKS = [
  { href: "#chapters", label: "Chapters", description: "Lessons, vocabulary, exercises and answers, one page per chapter" },
  { href: "#kana", label: "Kana", description: "Hiragana and katakana study pages" },
  { href: "#kanji", label: "Kanji", description: "Readings, example words and practice" },
  { href: "#documents", label: "Documents", description: "The original reviewers, answer keys and extras" },
];

// Jump links to the sections further down this page
export default function QuickAccess() {
  return (
    <nav aria-labelledby="quick-access-heading" className="mt-10">
      <h2 id="quick-access-heading" className="text-sm font-medium uppercase tracking-wide text-subtle">
        Quick access
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="flex h-full min-h-11 flex-col rounded-card border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-raised"
            >
              <span className="font-medium text-foreground">
                {l.label} <span aria-hidden="true" className="text-accent-text">↓</span>
              </span>
              <span className="mt-0.5 text-sm text-muted">{l.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
