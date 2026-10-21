import "server-only";
import WorkbookExercises from "@/components/WorkbookExercises";
import { workbookSet } from "@/lib/workbook-bank";
import { createElement, type ReactNode } from "react";
import englishCatalog from "@/data/english-display.json";
import catalog from "@/data/japanese-display.json";
import { parseStudyMarkup, studyDisplay, type StudyNode } from "@/lib/study-markup";
import StudyText from "@/components/StudyText";

export default function StudyHtml({ html, scope = "", literal = false, english = false }: { html: string; scope?: string; literal?: boolean; english?: boolean }) {
  function render(node: StudyNode, index: number, optional: boolean): ReactNode {
    if ("text" in node) {
      if (optional) return node.text;
      const display = studyDisplay(english ? englishCatalog : catalog, node.text, scope);
      return display.romaji ? <StudyText key={index} display={display} /> : display.primary;
    }
    if (node.tag === "div" && node.attrs["data-workbook-set"]) {
      const set = workbookSet(node.attrs["data-workbook-set"]);
      if (!set) throw new Error("Unknown workbook exercise set: " + node.attrs["data-workbook-set"]);
      return <WorkbookExercises key={index} set={set} />;
    }
    // Previously added native support panels keep their own explicit reveal.
    const skip = optional || node.tag === "details";
    const props: Record<string, string | number> = { key: index };
    for (const [name, value] of Object.entries(node.attrs)) props[name === "class" ? "className" : name] = value;
    return createElement(node.tag, props, ...node.children.map((child, i) => render(child, i, skip)));
  }
  return <>{parseStudyMarkup(html).map((node, i) => render(node, i, literal))}</>;
}
