import Brand from "@/components/Brand";
import NavLinks from "@/components/NavLinks";

// The desktop sidebar: the site name at the top, then the Study and Saved
// links. Only the links themselves are client code (to mark the current section).
export default function SidebarNav() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[4.5rem] shrink-0 items-center px-3">
        <Brand stacked />
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <NavLinks size="sidebar" />
      </nav>
    </div>
  );
}
