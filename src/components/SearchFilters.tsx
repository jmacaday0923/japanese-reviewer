"use client";

import type { Ref } from "react";
import { CATEGORIES, type CategoryFilter, type ChapterOption } from "@/lib/search";

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
      <div className="relative">
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
          className="w-full rounded-card border border-border bg-background py-3 pl-4 pr-12 text-lg text-foreground placeholder:text-subtle transition-colors focus:border-accent disabled:opacity-60 [&::-webkit-search-cancel-button]:appearance-none"
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

      <div className="mt-3 flex flex-wrap gap-2">
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
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-border bg-background text-muted hover:border-border-strong hover:text-foreground")
            }
          >
            {cat.label}
          </button>
        ))}
        <div className="relative">
          <select
            value={chapter}
            disabled={disabled}
            onChange={(e) => onChapterChange(e.target.value)}
            aria-label="Filter by chapter"
            className="min-h-10 appearance-none rounded-full border border-border bg-background pl-4 pr-9 text-sm text-muted transition-colors hover:border-border-strong disabled:opacity-60"
          >
            <option value="all">All chapters</option>
            {chapters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle">
            <path d="M6 8l4 4 4-4" />
          </svg>
        </div>
      </div>
    </>
  );
}
