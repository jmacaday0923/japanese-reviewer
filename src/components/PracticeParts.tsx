import type { ReactNode } from "react";
import type { ActivitySummary, Status } from "@/lib/exercises";
import Icon from "@/components/Icon";

// Pieces shared by the Particles and Vocabulary activities. No hooks, so
// they render wherever they're used.

// "Correct" or "Incorrect" in words, with an icon and color as extra cues
export function Verdict({ status }: { status: Exclude<Status, "unanswered"> }) {
  return status === "correct" ? (
    <span className="inline-flex items-center gap-1 font-semibold text-green-300">
      <Icon name="check" className="size-4" />
      Correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
      <Icon name="close" className="size-4" />
      Incorrect
    </span>
  );
}

// The explanation block under a checked question
export function Explanation({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-sm leading-relaxed text-muted">{children}</div>;
}

const BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const PRIMARY_BUTTON = `${BUTTON} bg-accent text-accent-foreground hover:bg-accent-hover disabled:hover:bg-accent`;
export const SECONDARY_BUTTON = `${BUTTON} border border-border-strong text-foreground hover:bg-surface-raised`;

type SummaryProps = {
  summary: ActivitySummary;
  noun: [string, string]; // ["question", "questions"] or ["word", "words"]
  onRetry: () => void;
  onRestart: () => void;
};

// Counts, the first try's score, retry progress, and the two buttons
export function PracticeSummary({ summary, noun, onRetry, onRestart }: SummaryProps) {
  const { total, correct, incorrect, unanswered, firstTry, retryRound, complete, canRetry } = summary;
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);

  return (
    <div className="mt-6 rounded-card border border-border bg-background/60 p-4">
      <h4 className="sr-only">Results</h4>
      {complete ? (
        <p className="flex items-center gap-2 font-semibold text-green-300">
          <Icon name="check" className="size-5" />
          All {total} {word(total)} correct. Practice complete.
        </p>
      ) : (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Count label="Correct" value={correct} className="text-green-300" />
          <Count label="Incorrect" value={incorrect} className="text-rose-300" />
          <Count label="Not checked yet" value={unanswered} className="text-muted" />
        </dl>
      )}

      {(firstTry || retryRound > 0) && (
        <ul className="mt-2 space-y-0.5 text-sm text-muted">
          {firstTry && (
            <li>
              First try: <span className="font-medium text-foreground">{firstTry.correct} of {firstTry.total}</span> correct
            </li>
          )}
          {retryRound > 0 && (
            <li>
              {retryRound === 1 ? "After retrying" : `After ${retryRound} retries`}:{" "}
              <span className="font-medium text-foreground">{correct} of {total}</span> correct
              {unanswered > 0 && `, ${unanswered} still to check`}
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {incorrect > 0 && (
          <button type="button" onClick={onRetry} disabled={!canRetry} className={PRIMARY_BUTTON}>
            <Icon name="retry" className="size-4" />
            Retry incorrect ({incorrect})
          </button>
        )}
        <button type="button" onClick={onRestart} className={SECONDARY_BUTTON}>
          Restart practice
        </button>
        {incorrect > 0 && !canRetry && (
          <p className="text-xs text-subtle">
            Check the remaining {unanswered} {word(unanswered)} to retry the incorrect ones.
          </p>
        )}
      </div>
    </div>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`order-first font-semibold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
