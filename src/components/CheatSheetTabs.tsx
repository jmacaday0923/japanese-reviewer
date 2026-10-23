"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type CheatSheet = { id: string; label: string; content: ReactNode };

// One cheat sheet at a time. Both sheets are rendered on the server; the tabs only show or hide them.
export default function CheatSheetTabs({ sheets }: { sheets: CheatSheet[] }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = sheets.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % sheets.length
      : event.key === "ArrowLeft" ? (index + last) % sheets.length
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <>
    <div role="tablist" aria-label="Cheat sheets" className="mt-8 flex flex-wrap gap-2 border-b border-border pb-4">
      {sheets.map((sheet, index) => (
        <button key={sheet.id} ref={node => { tabs.current[index] = node; }} type="button" role="tab"
          id={id + "-tab-" + index} aria-controls={sheet.id} aria-selected={selected === index}
          tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => move(event, index)}
          className={"min-h-11 rounded-full border px-5 text-base " + (selected === index ? "border-accent bg-accent font-medium text-accent-foreground" : "border-border text-muted hover:bg-surface-raised")}>
          {sheet.label}
        </button>
      ))}
    </div>
    {sheets.map((sheet, index) => (
      <section key={sheet.id} role="tabpanel" id={sheet.id} aria-labelledby={id + "-tab-" + index} hidden={selected !== index} className="mt-6">
        {sheet.content}
      </section>
    ))}
  </>;
}
