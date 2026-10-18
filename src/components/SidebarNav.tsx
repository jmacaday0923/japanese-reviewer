import NavLinks from "@/components/NavLinks";

// Desktop navigation, always visible on large screens. Only the links
// themselves are client code (to mark the current section).
export default function SidebarNav() {
  return (
    <nav aria-label="Main" className="px-3 py-6">
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-subtle">Study</p>
      <NavLinks size="sidebar" />
    </nav>
  );
}
