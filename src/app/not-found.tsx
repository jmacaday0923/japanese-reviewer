import Link from "next/link";

// Shown for pages that don't exist, like /chapters/99 or /practice/abc
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-subtle">404</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">That lesson or page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-10 items-center rounded-control border border-border bg-surface px-4 text-sm transition-colors hover:border-border-strong hover:bg-surface-raised"
      >
        Back to search
      </Link>
    </main>
  );
}
