import Brand from "@/components/Brand";
import MobileNav from "@/components/MobileNav";
import SidebarNav from "@/components/SidebarNav";
import { NavLocation } from "@/components/NavLinks";

// The frame around every page. Large screens: a full-height sidebar with the
// site name and navigation, and a slim toolbar above the content. Phones and
// tablets: a header with the menu button and the site name.
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

      <header className="sticky top-0 z-30 h-header border-b border-border bg-background/95 backdrop-blur lg:ml-60">
        <div className="relative flex h-full items-center gap-1 px-2 sm:px-4 lg:px-10">
          <MobileNav />
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="hidden lg:block">
            <NavLocation />
          </div>
        </div>
      </header>

      <aside className="hidden border-r border-border bg-background lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-60">
        <SidebarNav />
      </aside>

      <div id="content" tabIndex={-1} className="min-w-0 outline-none lg:pl-60">
        {children}
      </div>
    </>
  );
}
