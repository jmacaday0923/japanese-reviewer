import Link from "next/link";
import { NAV_ITEMS } from "@/components/nav-items";

// Desktop navigation, always visible on large screens
export default function SidebarNav() {
  return (
    <nav aria-label="Main" className="p-4">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-control px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
