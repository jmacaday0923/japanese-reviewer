import { Fragment } from "react";
import { checkpointTextParts } from "@/lib/checkpoint-display";
import type { CheckpointPresentation } from "@/types/checkpoint";

export default function CheckpointText({ text, presentation }: { text: string; presentation?: CheckpointPresentation }) {
  return <>{checkpointTextParts(text, presentation).map((part, index) => part.reading
    ? <ruby key={index} className="checkpoint-ruby">{part.text}<rp>(</rp><rt lang="ja">{part.reading}</rt><rp>)</rp></ruby>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
