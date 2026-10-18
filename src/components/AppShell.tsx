import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import SidebarNav from "@/components/SidebarNav";

// The frame around every page: header, sidebar on large screens, content area.
// Each page renders its own <main>, so the shell only adds a wrapper div.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 h-header border-b border-border bg-background/95 backdrop-blur">
        <div className="relative flex h-full items-center gap-1 px-2 sm:px-4 lg:px-6">
          <MobileNav />
          <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-control px-2 font-semibold tracking-tight">
            {/* Brand mark: 学 (study) in a small square; the text beside it names the link */}
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-[0.4rem] border border-accent/50 text-[0.9375rem] font-medium leading-none text-accent-text"
            >
              学
            </span>
            Japanese Lesson Reviewer
          </Link>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-background lg:block">
          <div className="sticky top-header max-h-[calc(100dvh-var(--header-height))] overflow-y-auto">
            <SidebarNav />
          </div>
        </aside>

        <div id="content" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </div>
      </div>
    </>
  );
}
