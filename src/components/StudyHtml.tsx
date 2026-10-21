import "server-only";
import WorkbookExercises from "@/components/WorkbookExercises";
import { workbookSet } from "@/lib/workbook-bank";
import { createElement, Fragment, type ReactNode } from "react";
import ExerciseAnswers from "@/components/ExerciseAnswers";
import { prepareExerciseDisplay } from "@/lib/study-markup";
import { legacyNodeBindings, type LegacyActivity } from "@/lib/legacy-exercises";
import englishCatalog from "@/data/english-display.json";
import catalog from "@/data/japanese-display.json";
import { parseStudyMarkup, studyDisplay, type StudyNode } from "@/lib/study-markup";
import StudyText from "@/components/StudyText";

export default function StudyHtml({ html, scope = "", literal = false, english = false, activities = [] }: { html: string; scope?: string; literal?: boolean; english?: boolean; activities?: LegacyActivity[] }) {
  const nodes = parseStudyMarkup(html);
  const bindings = legacyNodeBindings(nodes, activities);
  function instructions(activity: LegacyActivity, original?: ReactNode) {
    return <div data-exercise-directions={activity.heading} className="px-1">
      <p lang="ja" className="text-lg leading-relaxed">{activity.instructionsJa}</p>
      <div lang="en" className="text-sm leading-relaxed text-muted">
        {original}
        <p>{activity.instructionsEn}</p>
      </div>
    </div>;
  }
  function render(node: StudyNode, index: number, optional: boolean): ReactNode {
    if ("text" in node) {
      if (optional) return node.text;
      const display = studyDisplay(english ? englishCatalog : catalog, node.text, scope);
      return display.romaji ? <StudyText key={index} display={display} /> : display.primary;
    }
    const binding = bindings.get(node);
    if (binding?.kind === "translation") {
      const props: Record<string, string | number> = { key: index };
      for (const [name, value] of Object.entries(node.attrs)) props[name === "class" ? "className" : name] = value;
      return <Fragment key={index}>
        {createElement(node.tag, props, ...node.children.map((child, i) => render(child, i, optional)))}
        <details data-older-translation={binding.activity.heading} className="older-reading-support">
          <summary>English translation (optional)</summary>
          <div lang="en">{binding.activity.readingSupport!.english.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        </details>
      </Fragment>;
    }
    if (binding?.kind === "instructions") {
      return <Fragment key={index}>{instructions(binding.activity, createElement("p", { lang: "en" }, ...node.children.map((child, i) => render(child, i, false))))}</Fragment>;
    }
    if (binding?.kind === "table") {
      const activity = binding.activity;
      const rows = activity.questions.map(q => ({
        id: q.id, number: q.number, accepted: q.accepted,
        prompt: <StudyHtml html={q.promptHtml} scope={scope} />,
        model: prepareExerciseDisplay(parseStudyMarkup(q.modelHtml), catalog, scope.replace(/\/exercises$/, "/answers")),
        explanation: prepareExerciseDisplay(parseStudyMarkup(q.explanationHtml), catalog, scope.replace(/\/exercises$/, "/answers")),
      }));
      return <Fragment key={index}>
        {binding.showInstructions && instructions(activity)}
        <ExerciseAnswers heading={activity.heading} answerHeading={activity.answerHeading} mode={activity.mode} rows={rows} />
      </Fragment>;
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
  return <>{nodes.map((node, i) => render(node, i, literal))}</>;
}
