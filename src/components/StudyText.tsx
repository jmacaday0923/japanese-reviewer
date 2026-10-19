import type { StudyDisplay } from "@/lib/study-markup";
import { ReadingHint } from "@/components/ReadingPreferences";

// Client activities receive only their own prepared strings from the server.
// The full display catalog never crosses the client boundary.
export default function StudyText({ display, context }: { display: StudyDisplay; context?: string }) {
  return <>
    <span data-study-primary="" lang={/[ぁ-んァ-ン一-龯]/u.test(display.primary) && !/[A-Za-z]/u.test(display.primary) ? "ja" : undefined}>{display.primary}</span>
    {display.romaji && <span className="study-romaji">
      <ReadingHint kind="romaji" context={context ?? (display.primary.slice(0, 80) || "this text")} compact>{display.romaji}</ReadingHint>
    </span>}
  </>;
}
