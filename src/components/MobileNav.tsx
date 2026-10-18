"use client";

import { useEffect, useRef, useState } from "react";
import NavLinks from "@/components/NavLinks";
import Icon from "@/components/Icon";

// Menu button and drop-down list for phones and tablets
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu and puts focus back on the button
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <Icon name={open ? "close" : "menu"} />
      </button>

      <nav
        id="mobile-nav"
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-height))] overflow-y-auto overscroll-contain border-b border-border bg-background px-3 py-4"
      >
        <NavLinks size="menu" onNavigate={() => setOpen(false)} />
      </nav>
    </div>
  );
}
