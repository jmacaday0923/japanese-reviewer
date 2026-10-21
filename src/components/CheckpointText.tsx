import { Fragment } from "react";
import { checkpointTextParts } from "@/lib/checkpoint-display";
import type { CheckpointPresentation, CheckpointTextPart } from "@/types/checkpoint";

export default function CheckpointText({ text, presentation, parts }: { text: string; presentation?: CheckpointPresentation; parts?: CheckpointTextPart[] }) {
  return <>{(parts ?? checkpointTextParts(text, presentation)).map((part, index) => part.reading
    ? <ruby key={index} className="checkpoint-ruby">{part.text}<rp>(</rp><rt lang="ja">{part.reading}</rt><rp>)</rp></ruby>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
