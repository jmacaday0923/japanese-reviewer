import type { Chapter } from "@/types/lesson";
import type { StudyNode } from "@/lib/study-markup";

export type LegacyQuestion = {
  id: string; number: string; promptHtml: string; modelHtml: string; explanationHtml: string;
  accepted: string[];
};
export type LegacyActivity = {
  heading: string; title: string; answerHeading: string; instruction: string;
  instructionsJa: string; instructionsEn: string; mode: "choice" | "particle" | "kana" | "self";
  questions: LegacyQuestion[];
  readingSupport?: { japanese: string[]; english: string[] };
};
type SourceTable = { heading: string; title: string; instruction: string; headers: string[]; rows: StudyNode[][] };
type Parser = (html: string) => StudyNode[];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
export const studyNodeText = (node: StudyNode): string => "text" in node ? node.text : node.tag === "br" ? "\n" : node.children.map(studyNodeText).join("");
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function studyNodeHtml(node: StudyNode): string {
  if ("text" in node) return escape(node.text);
  const attrs = Object.entries(node.attrs).map(([key, value]) => " " + key + '="' + escape(value) + '"').join("");
  return "<" + node.tag + attrs + ">" + (["br", "hr"].includes(node.tag) ? "" : node.children.map(studyNodeHtml).join("") + "</" + node.tag + ">");
}
const innerHtml = (node: StudyNode) => "text" in node ? escape(node.text) : node.children.map(studyNodeHtml).join("");

function sourceTables(html: string, parse: Parser): SourceTable[] {
  const tables: SourceTable[] = [];
  let heading = "", title = "", instruction = "";
  function visit(node: StudyNode, optional = false) {
    if ("text" in node) return;
    if (/^h[34]$/.test(node.tag)) { heading = node.attrs.id ?? ""; title = clean(studyNodeText(node)); instruction = ""; }
    if (node.tag === "p" && !optional && !instruction && /[a-z]/i.test(studyNodeText(node))) instruction = clean(studyNodeText(node));
    if (node.tag === "table" && !optional) {
      const headers: string[] = [], rows: StudyNode[][] = [];
      function collect(n: StudyNode) {
        if ("text" in n) return;
        if (n.tag === "th") headers.push(clean(studyNodeText(n)));
        if (n.tag === "tr") {
          const cells = n.children.filter(c => !("text" in c) && c.tag === "td");
          if (cells.length) rows.push(cells);
        }
        for (const c of n.children) collect(c);
      }
      collect(node); tables.push({ heading, title, instruction, headers, rows });
    }
    for (const c of node.children) visit(c, optional || node.tag === "details");
  }
  for (const n of parse(html)) visit(n);
  return tables;
}

// Only closed, source-keyed tasks are machine graded. Free Japanese, translations,
// multi-form conjugation and meaning questions need model comparison, not string equality.
const PARTICLES: Record<string, string> = {
  wa: "は", no: "の", to: "と", ka: "か", mo: "も", ni: "に", ga: "が",
  de: "で", e: "へ", o: "を", wo: "を", kara: "から", made: "まで", ya: "や",
  "ni wa": "には", "de wa": "では", "to wa": "とは", "ni mo": "にも",
};
function acceptance(title: string, prompt: string, answer: string): { mode: "choice" | "particle" | "kana"; values: string[] } | null {
  if (!/composition|words in order/i.test(title) && /\b1\s+[\s\S]+\b2\s+[\s\S]+\b3\s+[\s\S]+\b4\s+/u.test(prompt)) {
    const key = /^([1-4])(?:\s+|[.:)]\s*)(.*)$/u.exec(answer);
    if (key && !/^(?:[1-4]\b|and\b|or\b)/i.test(key[2])) return { mode: "choice", values: [key[1]] };
  }
  if (/marker|particle/i.test(title)) {
    const forms = [...answer.matchAll(/[a-z]+(?: [a-z]+)?|[ぁ-ん]+/gu)].map(m => m[0]);
    const allowed = forms.flatMap(form => PARTICLES[form] ? [form, PARTICLES[form]] : Object.values(PARTICLES).includes(form) ? [form] : []);
    // Explanatory sentences and unrecognised strings are deliberately not exact-graded.
    if (allowed.length && forms.every(form => PARTICLES[form] || Object.values(PARTICLES).includes(form) || form === "or"))
      return { mode: "particle", values: [...new Set(allowed)] };
  }
  if (!/question and answer|answer.*question|translation|translate|personal|sentence|say it the other way/i.test(title) &&
    /say |read |write |number|counter|family words|countries|opposites|pick the|choose the (?:right|question|position|adjective)|make the suru|dictionary form|nai form|ta form|nakatta form/i.test(title)) {
    // One explicitly printed kana form, not a sentence or a slash-separated
    // list of transformations. Kana checking is stated in the instructions.
    const form = /^([A-Za-z'-]+(?: [A-Za-z'-]+)?)\s*\(([ぁ-ゖァ-ヺー ]+)\)$/u.exec(answer.trim());
    if (form) return { mode: "kana", values: [form[2], form[1]] };
  }
  return null;
}

export function buildLegacyActivities(chapter: Chapter, parse: Parser): LegacyActivity[] {
  if (!(Number(chapter.ch) >= 1 && Number(chapter.ch) <= 10)) return [];
  const exercises = chapter.sections.find(s => s.id === "exercises"), answers = chapter.sections.find(s => s.id === "answers");
  if (!exercises || !answers) return [];
  const keys = sourceTables(answers.html, parse);
  return sourceTables(exercises.html, parse).filter(t => t.headers.join("|") === "#|Question|Your answer").map(table => {
    const key = keys.find(k => k.heading === table.heading + "-2") ?? keys.find(k => k.title === table.title);
    if (!key || key.rows.length !== table.rows.length) throw new Error("Exercise/answer coverage differs: " + table.heading);
    const pairs = table.rows.map(cells => {
      const number = clean(studyNodeText(cells[0]));
      const answer = key.rows.find(row => clean(studyNodeText(row[0])) === number);
      if (!answer?.[1] || !answer[2]) throw new Error("Missing model or explanation: " + table.heading + " #" + number);
      const prompt = studyNodeText(cells[1]), model = studyNodeText(answer[1]);
      return {
        acceptance: acceptance(table.title, prompt, model),
        question: { id: table.heading + "-question-" + number, number, promptHtml: innerHtml(cells[1]),
          modelHtml: innerHtml(answer[1]), explanationHtml: innerHtml(answer[2]), accepted: [] as string[] },
      };
    });
    const automatic = pairs.every(p => p.acceptance && p.acceptance.mode === pairs[0].acceptance?.mode);
    const mode = automatic ? pairs[0].acceptance!.mode : "self";
    return {
      heading: table.heading, title: table.title, answerHeading: key.heading, instruction: table.instruction, mode,
      instructionsJa: mode === "choice" ? "問題を読んで、正しい番号を選んでください。選んだあとで答え合わせをしましょう。"
        : mode === "particle" ? "空欄に入る助詞を書いてください。書いたあとで答え合わせをしましょう。"
        : mode === "kana" ? "かなで答えを書いてください。教科書にある形と比べて、答え合わせをしましょう。"
        : "問題と英語の指示を読んで、答えを書いてください。答えの例と比べて、自分で確認しましょう。",
      instructionsEn: mode === "choice" ? "Read the question and choose the correct numbered option. Then check your answer."
        : mode === "particle" ? "Write the missing particle, then check your answer."
        : mode === "kana" ? "Answer in kana using the form printed in the lesson. This activity checks that source form; its printed romaji is also accepted."
        : "Follow the task instructions and write your answer. Reveal the model, compare its meaning and form, then record your self-check. Other valid answers may differ.",
      questions: pairs.map(p => ({ ...p.question, accepted: automatic ? p.acceptance!.values : [] })),
    };
  });
}

// Bind source nodes before React rendering. The renderer receives immutable
// associations rather than changing heading state while creating elements.
export function legacyNodeBindings(nodes: StudyNode[], activities: LegacyActivity[]) {
  const bindings = new Map<StudyNode, { activity: LegacyActivity; kind: "instructions" | "table" | "translation"; showInstructions: boolean }>();
  if (!activities.length) return bindings;
  const byHeading = new Map(activities.map(a => [a.heading, a])), seen = new Set<string>();
  let active: LegacyActivity | undefined;
  function visit(node: StudyNode, optional = false) {
    if ("text" in node) return;
    if (/^h[34]$/.test(node.tag) && node.attrs.id) active = byHeading.get(node.attrs.id);
    if (!optional && active && node.tag === "p" && !seen.has(active.heading) && clean(studyNodeText(node)) === active.instruction) {
      bindings.set(node, { activity: active, kind: "instructions", showInstructions: true }); seen.add(active.heading);
    }
    if (!optional && active?.readingSupport && node.tag === "p" &&
      clean(studyNodeText(node)) === clean(active.readingSupport.japanese.at(-1)!)) {
      bindings.set(node, { activity: active, kind: "translation", showInstructions: false });
    }
    if (!optional && active && node.tag === "table") {
      bindings.set(node, { activity: active, kind: "table", showInstructions: !seen.has(active.heading) });
      seen.add(active.heading); return;
    }
    for (const child of node.children) visit(child, optional || node.tag === "details");
  }
  for (const node of nodes) visit(node);
  return bindings;
}
