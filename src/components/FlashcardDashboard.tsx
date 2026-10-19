"use client";
import englishCatalog from "@/data/english-display.json";
import { studyDisplay } from "@/lib/study-markup";
import StudyText from "@/components/StudyText";
import Link from "next/link";
import FlashcardDeckPicker from "@/components/FlashcardDeckPicker";
import { newFlashcardSeed, useFlashcardShuffleSeed } from "@/components/use-flashcard-shuffle";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ReadingControls, ReadingHint } from "@/components/ReadingPreferences";
import { flashcardStore, useFlashcards } from "@/components/use-flashcards";
import {
  DIRECTIONS, RATINGS, addFlashcards, bulkAddMessage, shuffledFlashcardIds, inSources, performance, removeFlashcard, restoreFlashcard, reviewFlashcard,
  reviewQueue, scheduleReview, setNewLimit, sourceOptions,
  type Direction, type Rating, type SavedFlashcard, type FlashcardDraft, type FlashcardDeckInfo,
} from "@/lib/flashcards";

const BUTTON = "min-h-11 rounded-control border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-raised disabled:opacity-50";
const DIRECTION_LABELS: Record<Direction, string> = { recognition: "Japanese → meaning", recall: "English → Japanese" };
const RATING_LABELS: Record<Rating, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const readClock = () => Math.floor(Date.now() / 30_000) * 30_000;
const serverClock = () => 0;
function subscribeClock(update: () => void) {
  const timer = window.setInterval(update, 30_000);
  window.addEventListener("focus", update);
  document.addEventListener("visibilitychange", update);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
}
const dueLabel = (time: number) => new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
function intervalLabel(card: SavedFlashcard, direction: Direction, rating: Rating, now: number) {
  const next = scheduleReview(card.progress[direction], rating, now);
  return next.intervalDays === 0 ? Math.round((next.dueAt - now) / 60_000) + " min" : next.intervalDays + (next.intervalDays === 1 ? " day" : " days");
}

export function ReviewCard({ card, direction, now, onRate }: {
  card: SavedFlashcard; direction: Direction; now: number; onRate: (rating: Rating) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const answer = useRef<HTMLDivElement>(null);
  useEffect(() => { if (revealed) answer.current?.focus(); }, [revealed]);
  return (
    <article data-flashcard-review="" className="mt-5 min-w-0 rounded-card border border-border bg-surface p-5 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{card.kind} · {card.kind === "kana" ? (direction === "recognition" ? "Kana → reading" : "Romaji → kana") : DIRECTION_LABELS[direction]}</p>
      <h2 className="mt-5 break-words text-3xl font-semibold leading-relaxed text-foreground sm:text-4xl" lang={direction === "recognition" ? "ja" : "en"}>
        {direction === "recognition" ? card.japanese : card.kind === "kana" ? <ReadingHint kind="romaji" context="this reverse kana card" compact>{card.meaning}</ReadingHint> : <StudyText display={studyDisplay(englishCatalog, card.meaning)} />}
      </h2>
      <p className="mt-3 text-sm text-muted">Recall the answer, then reveal it and rate how well you remembered.</p>
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className={BUTTON + " mt-6 border-accent bg-accent text-accent-foreground hover:bg-accent-hover"}>
          Reveal answer
        </button>
      ) : (
        <div ref={answer} tabIndex={-1} data-flashcard-answer="" className="mt-6 border-t border-border pt-5 focus-visible:outline-2 focus-visible:outline-accent-text">
          {direction === "recall" && <p lang="ja" className="break-words text-3xl font-semibold leading-relaxed">{card.japanese}</p>}
          <dl className="mt-3 space-y-3">
            {card.kana && <div><dt className="text-xs text-subtle">Kana readings</dt><dd lang="ja" className="mt-1 break-words text-lg"><ReadingHint kind="kana" context={card.japanese}>{card.kana}</ReadingHint></dd></div>}
            {card.romaji && (card.kind !== "kana" || direction === "recall") && <div><dt className="text-xs text-subtle">Romaji</dt><dd className="mt-1 break-words text-accent-text"><ReadingHint kind="romaji" context={card.japanese}>{card.romaji}</ReadingHint></dd></div>}
            {direction === "recognition" && <div><dt className="text-xs text-subtle">{card.kind === "kana" ? "Reading (romaji)" : "Meaning"}</dt><dd className="mt-1 break-words text-lg"><ReadingHint kind={card.kind === "kana" ? "romaji" : "english"} context={card.japanese}><StudyText display={studyDisplay(englishCatalog, card.meaning)} /></ReadingHint></dd></div>}
          </dl>
          {card.examples.length > 0 && (
            <div className="mt-6 rounded-control border border-border bg-background p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Source example</h3>
              <p lang="ja" className="mt-2 break-words text-lg leading-relaxed">{card.examples[0].japanese}</p>
              {card.examples[0].romaji && <p className="mt-2 break-words text-sm text-accent-text"><ReadingHint kind="romaji" context="the source example">{card.examples[0].romaji}</ReadingHint></p>}
              <p className="mt-2 break-words text-sm text-muted"><ReadingHint kind="english" context="the source example"><StudyText display={studyDisplay(englishCatalog, card.examples[0].english)} /></ReadingHint></p>
              <Link href={card.examples[0].href} className="mt-3 inline-flex min-h-11 items-center text-sm text-accent-text hover:underline">Open example in lesson →</Link>
            </div>
          )}
          <div role="group" aria-label="Rate your recall" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((rating) => (
              <button type="button" key={rating} onClick={() => onRate(rating)} className={BUTTON + " flex flex-col items-center gap-1 py-3"}>
                <span>{RATING_LABELS[rating]}</span><span className="text-xs font-normal text-muted">{intervalLabel(card, direction, rating, now)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
        {card.sources.map((source) => (
          <Link key={source.href} href={source.href} className="inline-flex min-h-11 items-center break-words text-xs text-accent-text hover:underline">
            {revealed ? source.label : source.label.split(" › ")[0]} →
          </Link>
        ))}
      </div>
    </article>
  );
}

export default function FlashcardDashboard({ decks }: { decks: FlashcardDeckInfo[] }) {
  const { ready, saved, data } = useFlashcards();
  const initialSeed = useFlashcardShuffleSeed();
  const [seed, setSeed] = useState<number | null>(null);
  const now = useSyncExternalStore(subscribeClock, readClock, serverClock);
  const [direction, setDirection] = useState<Direction>("recognition");
  const [selected, setSelected] = useState<string[]>([]);
  const [removed, setRemoved] = useState<SavedFlashcard | null>(null);
  const [manageLimit, setManageLimit] = useState(20);
  const [reviewed, setReviewed] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reviewed > 0) container.current?.querySelector<HTMLElement>("[data-flashcard-review] button, [data-queue-complete]")?.focus();
  }, [reviewed]);
  const queue = reviewQueue(data, direction, selected, now, shuffledFlashcardIds(data.cards, seed ?? initialSeed));
  const current = queue.cards[0];
  const options = sourceOptions(data.cards);
  const filtered = data.cards.filter((card) => inSources(card, selected));
  function rate(rating: Rating) {
    if (!current) return;
    const changed = flashcardStore.update((data) => reviewFlashcard(data, current.id, direction, rating, Date.now(), current.progress[direction].reviews));
    if (changed) setReviewed((count) => count + 1);
  }
  function choose(key: string) {
    setSelected((keys) => keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]);
  }
  function startDecks(drafts: FlashcardDraft[], keys: string[]) {
    let message = "";
    flashcardStore.update((data) => {
      const result = addFlashcards(data, drafts, Date.now());
      message = bulkAddMessage(result);
      return result.data;
    });
    setSelected(keys); setSeed(newFlashcardSeed()); setReviewed((count) => count + 1);
    return message;
  }
  if (!ready || now === 0 || initialSeed === 0) return <p className="mt-8 text-muted" role="status">Loading your flashcards…</p>;
  return (
    <div ref={container}>
      {!saved && <p role="status" className="mt-5 rounded-card border border-border p-3 text-sm text-muted">This browser cannot save flashcards. Unsaved changes are lost when you reload or close this tab.</p>}
      <FlashcardDeckPicker decks={decks} onStart={startDecks} />
      <section aria-label="Review settings" className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
        <fieldset>
          <legend className="text-sm font-semibold">Review direction</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIRECTIONS.map((item) => <button key={item} type="button" aria-pressed={direction === item} onClick={() => setDirection(item)}
              className={BUTTON + (direction === item ? " border-accent-text bg-accent-soft text-accent-text" : " text-muted")}>{DIRECTION_LABELS[item]}</button>)}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Chapters and study pages</legend>
          <button type="button" className={BUTTON + " mt-2"} aria-pressed={selected.length === 0} onClick={() => setSelected([])}>All saved cards</button>
          <div className="mt-2 flex max-h-48 flex-wrap gap-x-5 gap-y-1 overflow-y-auto">
            {options.map((option) => <label key={option.key} className="inline-flex min-h-11 max-w-full items-center gap-2 break-words text-sm">
              <input type="checkbox" checked={selected.includes(option.key)} onChange={() => choose(option.key)} className="size-4 shrink-0 accent-accent" />
              {option.label.split(" › ")[0]}
            </label>)}
          </div>
        </fieldset>
        <label className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium">
          New cards per day (each direction)
          <input type="number" min={0} max={200} step={1} value={data.newLimit}
            onChange={(event) => flashcardStore.update((data) => setNewLimit(data, Number(event.target.value)))}
            className="min-h-11 w-24 rounded-control border border-border-strong bg-background px-3 text-foreground" />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-muted">The new-card limit applies across all chapters. Scheduled reviews have no daily limit. Set 0 to pause new cards.</p>
      </section>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[["Saved in selection", queue.totalCount], ["Due today", queue.dueCount], ["New in queue", queue.newCount]].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>
        ))}
      </dl>
      <p role="status" className="mt-3 text-sm text-muted">{queue.introducedToday} of {data.newLimit} new cards reviewed today in this direction.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON} disabled={queue.cards.length < 2} onClick={() => setSeed(newFlashcardSeed())}>Shuffle review order</button>
        <p className="text-xs text-muted">Due cards come first. New cards are drawn randomly within your daily limit. Kana character cards use a romaji prompt in the reverse direction.</p>
      </div>
      <ReadingControls />

      {data.cards.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-border-strong p-8 text-center">
          <h2 className="text-xl font-semibold">Save your first flashcard</h2>
          <p className="mt-2 text-muted">Choose a pre-made deck above, or use Add to flashcards beside vocabulary, kanji, or a lesson sentence.</p>
          <Link href="/#chapters" className={BUTTON + " mt-5 inline-flex items-center text-accent-text"}>Browse lessons →</Link>
        </div>
      ) : current ? (
        <ReviewCard key={(seed ?? initialSeed) + ":" + direction + ":" + current.id + ":" + current.progress[direction].reviews + ":" + selected.slice().sort().join(",")}
          card={current} direction={direction} now={now} onRate={rate} />
      ) : (
        <section data-queue-complete="" tabIndex={-1} className="mt-6 rounded-card border border-border bg-surface p-6 focus-visible:outline-2 focus-visible:outline-accent-text" aria-label="Queue complete">
          <h2 className="text-xl font-semibold">{queue.totalCount === 0 ? "No saved cards in this selection" : "You’re caught up for now"}</h2>
          <p className="mt-2 text-sm text-muted">
            {queue.remaining === 0 ? "Your new-card allowance is used. Scheduled reviews still appear when due." : "No cards are due in this selection."}
          </p>
          {queue.nextDueAt !== null && <p className="mt-2 text-sm text-muted">Next scheduled review: {dueLabel(queue.nextDueAt)}.</p>}
        </section>
      )}

      <section aria-label="Performance by direction" className="mt-8">
        <h2 className="text-lg font-semibold">Your performance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DIRECTIONS.map((item) => {
            const stats = performance(filtered, item);
            return <div key={item} className="rounded-card border border-border p-4">
              <h3 className="text-sm font-medium">{DIRECTION_LABELS[item]}</h3>
              <p className="mt-2 text-sm text-muted">{stats.reviews} ratings · {stats.reviews ? stats.percent + "% remembered" : "No reviews yet"}</p>
              <p className="mt-1 text-xs text-subtle">Again: {stats.again} · Hard, Good or Easy: {stats.remembered}</p>
            </div>;
          })}
        </div>
      </section>

      {removed && <p role="status" className="mt-5 text-sm text-muted">Card removed. <button type="button" className="min-h-11 px-2 text-accent-text hover:underline"
        onClick={() => { flashcardStore.update((data) => restoreFlashcard(data, removed)); setRemoved(null); }}>Undo removal</button></p>}
      {filtered.length > 0 && <details className="mt-7 rounded-card border border-border p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Manage saved cards ({filtered.length})</summary>
        <ul className="mt-2 divide-y divide-border">
          {filtered.slice(0, manageLimit).map((card) => <li key={card.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 flex-1"><p lang="ja" className="break-words font-medium">{card.japanese}</p><p className="break-words text-sm text-muted">{card.kind === "kana" ? <ReadingHint kind="romaji" context="this saved kana card" compact>{card.meaning}</ReadingHint> : <StudyText display={studyDisplay(englishCatalog, card.meaning)} />}</p></div>
            <button type="button" aria-label={"Remove " + card.japanese + " from flashcards"} className={BUTTON + " text-muted"}
              onClick={() => { flashcardStore.update((data) => removeFlashcard(data, card.id)); setRemoved(card); }}>Remove</button>
          </li>)}
        </ul>
        {filtered.length > manageLimit && <button type="button" className={BUTTON + " mt-3"} onClick={() => setManageLimit((limit) => limit + 20)}>Show more saved cards</button>}
      </details>}
    </div>
  );
}
