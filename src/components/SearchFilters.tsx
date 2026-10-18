"use client";

import type { Ref } from "react";
import { CATEGORIES, type CategoryFilter, type ChapterOption } from "@/lib/search";
import Icon from "@/components/Icon";

type Props = {
  inputRef?: Ref<HTMLInputElement>;
  draft: string;
  category: CategoryFilter;
  chapter: string;
  chapters: ChapterOption[];
  disabled?: boolean;
  shortcut?: string | null; // "⌘K" or "Ctrl K" once the keyboard shortcut is listening
  onDraftChange: (value: string, composing: boolean) => void;
  onCompositionEnd: (value: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onChapterChange: (chapter: string) => void;
  onClearText: () => void;
};

export default function SearchFilters({
  inputRef,
  draft,
  category,
  chapter,
  chapters,
  disabled = false,
  shortcut = null,
  onDraftChange,
  onCompositionEnd,
  onCategoryChange,
  onChapterChange,
  onClearText,
}: Props) {
  return (
    <>
      <div className="relative mt-4">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle">
          <Icon name="search" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={draft}
          disabled={disabled}
          onChange={(e) => onDraftChange(e.target.value, (e.nativeEvent as InputEvent).isComposing === true)}
          onCompositionEnd={(e) => onCompositionEnd(e.currentTarget.value)}
          placeholder="Search kana, romaji, or English..."
          aria-label="Search lessons"
          aria-keyshortcuts={shortcut ? "Meta+K Control+K" : undefined}
          autoComplete="off"
          className={
            "min-h-13 w-full rounded-card border border-border-strong bg-background py-3 pl-12 text-base text-foreground placeholder:text-subtle transition-colors focus:border-accent-text disabled:opacity-60 sm:text-lg [&::-webkit-search-cancel-button]:appearance-none " +
            // Room on the right for the clear button, or for the shortcut hint (not shown on phones)
            (draft !== "" ? "pr-12" : "pr-3 sm:pr-20")
          }
        />
        {draft !== "" && !disabled ? (
          <button
            type="button"
            onClick={onClearText}
            aria-label="Clear search text"
            className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <Icon name="close" className="size-4" />
          </button>
        ) : (
          shortcut && (
            // Only shown once the shortcut works; the input's aria-keyshortcuts tells screen readers
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[0.375rem] border border-border bg-surface-raised px-2 py-0.5 font-sans text-xs font-medium text-muted sm:block"
            >
              {shortcut}
            </kbd>
          )
        )}
      </div>

      {/* Category pills, then the chapter menu: one row on wide screens,
          wrapping naturally on smaller ones */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              type="button"
              disabled={disabled}
              aria-pressed={category === cat.value}
              className={
                "min-h-10 rounded-full border px-4 text-sm transition-colors disabled:opacity-60 " +
                (category === cat.value
                  ? "border-accent bg-accent font-medium text-accent-foreground hover:bg-accent-hover"
                  : "border-border text-muted hover:border-border-strong hover:bg-surface-raised hover:text-foreground")
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto lg:ml-auto">
          <select
            value={chapter}
            disabled={disabled}
            onChange={(e) => onChapterChange(e.target.value)}
            aria-label="Filter by chapter"
            className={
              "min-h-10 w-full appearance-none rounded-control border bg-background pl-3.5 pr-10 text-sm transition-colors hover:bg-surface-raised disabled:opacity-60 sm:w-auto " +
              (chapter === "all" ? "border-border-strong text-muted" : "border-accent-text font-medium text-accent-text")
            }
          >
            <option value="all">All chapters</option>
            {chapters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-down"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          />
        </div>
      </div>
    </>
  );
}
