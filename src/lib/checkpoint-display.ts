import type { CheckpointPresentation } from "@/types/checkpoint";

export type CheckpointTextPart = { text: string; reading?: string };

// Exact, reviewed text overrides and readings. No automatic transliteration,
// HTML parsing or dependency on the user's reading-aid preferences.
export function checkpointTextParts(text: string, presentation?: CheckpointPresentation): CheckpointTextPart[] {
  if (!presentation) return [{ text }];
  const display = presentation.kana[text] ?? text;
  const words = Object.keys(presentation.readings).sort((a, b) => b.length - a.length);
  const pattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pieces = pattern ? display.split(new RegExp("(" + pattern + ")", "u")) : [display];
  return pieces.filter(Boolean).map(piece => {
    const reading = presentation.readings[piece];
    if (reading) return { text: piece, reading };
    if (/[\p{Script=Han}々]/u.test(piece)) throw new Error("Missing Chapter 5 checkpoint reading: " + piece);
    return { text: piece };
  });
}
