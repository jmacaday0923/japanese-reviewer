import { createElement, Fragment } from "react";
import StudyText from "@/components/StudyText";
import type { ExerciseDisplayNode } from "@/lib/study-markup";

// Nodes come from the existing trusted study parser, not user input.
export default function ExerciseText({ nodes }: { nodes: ExerciseDisplayNode[] }) {
  return <>{nodes.map((node, index) => {
    if ("text" in node) return <Fragment key={index}>{node.text}</Fragment>;
    if ("display" in node) return <StudyText key={index} display={node.display} />;
    const props: Record<string, string | number> = { key: index };
    for (const [name, value] of Object.entries(node.attrs)) props[name === "class" ? "className" : name] = value;
    return createElement(node.tag, props, node.children.length ? <ExerciseText nodes={node.children} /> : undefined);
  })}</>;
}
