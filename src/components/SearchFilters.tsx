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
          autoComplete="off"
          className="min-h-13 w-full rounded-card border border-border-strong bg-background py-3 pl-12 pr-12 text-lg text-foreground placeholder:text-subtle transition-colors focus:border-accent disabled:opacity-60 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft !== "" && !disabled && (
          <button
            type="button"
            onClick={onClearText}
            aria-label="Clear search text"
            className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-subtle transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-4">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        )}
      </div>

      {/* Category buttons and the chapter menu, as one toolbar */}
      <div className="mt-3 flex flex-col gap-1 rounded-card border border-border bg-background p-1 sm:flex-row sm:items-center">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              type="button"
              disabled={disabled}
              aria-pressed={category === cat.value}
              className={
                "min-h-10 rounded-control px-3.5 text-sm transition-colors disabled:opacity-60 " +
                (category === cat.value
                  ? "bg-accent-soft font-medium text-accent-text"
                  : "text-muted hover:bg-surface-raised hover:text-foreground")
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-1 sm:ml-auto sm:border-l sm:border-t-0 sm:pl-1 sm:pt-0">
          <div className="relative">
            <select
              value={chapter}
              disabled={disabled}
              onChange={(e) => onChapterChange(e.target.value)}
              aria-label="Filter by chapter"
              className={
                "min-h-10 w-full appearance-none rounded-control bg-background pl-3.5 pr-9 text-sm transition-colors hover:bg-surface-raised disabled:opacity-60 sm:w-auto " +
                (chapter === "all" ? "text-muted" : "font-medium text-accent-text")
              }
            >
              <option value="all">All chapters</option>
              {chapters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle">
              <path d="M6 8l4 4 4-4" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
