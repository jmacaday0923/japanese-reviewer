import type { Chapter } from "@/types/lesson";
import type { Chapter10CheckpointPolicy, CheckpointExam, CheckpointPresentation, CheckpointTextPart } from "@/types/checkpoint";

const kanji = (text: string) => [...text.matchAll(/[\p{Script=Han}々]/gu)].map(match => match[0]);
export function kanji1Characters(page: Chapter): string {
  if (page.ch !== "1") throw new Error("Expected the Kanji 1 topic");
  const lessons = page.sections.find(section => section.id === "lessons")?.html ?? "";
  // The core teaching headings, not incidental kanji in explanations or words.
  const characters = [...lessons.matchAll(/<h3\b[^>]*>\s*([\p{Script=Han}])\s*\(/gu)].map(match => match[1]);
  if (!characters.length || new Set(characters).size !== characters.length) throw new Error("Review the Kanji 1 teaching headings");
  return characters.join("");
}

type Scope = { known: Set<string>; seen: Set<string>; protected: Set<string>; instructions: boolean };

// Runs before React rendering. Each item owns its own local set; React never
// mutates annotation state, so retries, hydration and tab changes stay stable.
export function annotateCheckpointText(text: string, policy: Chapter10CheckpointPolicy, scope: Scope): CheckpointTextPart[] {
  const words = Object.keys(policy.lexicon).sort((a, b) => b.length - a.length);
  const pattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pieces = pattern ? text.split(new RegExp("(" + pattern + ")", "u")) : [text];
  return pieces.filter(Boolean).flatMap(piece => {
    const segments = Object.hasOwn(policy.lexicon, piece) ? policy.lexicon[piece] : [{ text: piece }];
    return segments.map(segment => {
      const characters = kanji(segment.text);
      const needs = characters.filter(character => !scope.protected.has(character) &&
        (scope.instructions || !scope.known.has(character) && !scope.seen.has(character)));
      if (needs.length && !segment.reading) throw new Error("Missing Chapter 10 checkpoint reading: " + segment.text);
      // Reviewed readings are split at kanji boundaries so a repeated or
      // familiar character never receives another character's annotation.
      if (segment.reading && characters.length !== 1) throw new Error("Split the reviewed reading at each kanji: " + segment.text);
      for (const character of characters) scope.seen.add(character);
      return needs.length ? { text: segment.text, reading: segment.reading! } : { text: segment.text };
    });
  });
}

export function buildChapter10Presentation(exam: CheckpointExam, policy: Chapter10CheckpointPolicy, knownKanji: string): CheckpointPresentation {
  const config = policy.exams[exam.id];
  if (!config) throw new Error("No Chapter 10 display policy for " + exam.id);
  const prepared: NonNullable<CheckpointPresentation["prepared"]> = { titles: {}, instructions: {}, questions: {} };
  const known = new Set(knownKanji);
  for (const part of exam.parts) {
    if (!config.instructionsEn[part.id]) throw new Error("Missing English checkpoint instructions: " + part.id);
    const directions = (value: string) => annotateCheckpointText(value, policy, { known, seen: new Set(), protected: new Set(), instructions: true });
    prepared.titles[part.id] = directions(part.titleJa);
    prepared.instructions[part.id] = directions(part.instructionsJa);
    for (const [index, question] of part.questions.entries()) {
      const protectedCharacters = new Set(kanji(question.target ?? ""));
      if (config.protectChoiceReadings.includes(part.id))
        for (const choice of question.choices) for (const character of kanji(choice.text)) protectedCharacters.add(character);
      const scope: Scope = { known, seen: new Set(), protected: protectedCharacters, instructions: false };
      const read = (value: string) => annotateCheckpointText(value, policy, scope);
      const showPassage = question.passage && question.passage.id !== part.questions[index - 1]?.passage?.id;
      // Follow visible document order across this question, including review.
      prepared.questions[question.id] = {
        passage: showPassage ? read(question.passage!.text) : undefined,
        context: question.context ? read(question.context) : undefined,
        prompt: read(question.prompt),
        composition: question.composition ? { before: read(question.composition.before), after: read(question.composition.after) } : undefined,
        choices: Object.fromEntries(question.choices.map(choice => [choice.id, read(choice.text)])),
        answer: read(question.choices.find(choice => choice.id === question.correctChoiceId)!.text),
        completedSentence: question.completedSentence ? read(question.completedSentence) : undefined,
        explanationJa: read(question.explanationJa),
        explanationEn: read(question.explanationEn),
      };
    }
  }
  return { examId: exam.id, kana: {}, readings: {}, instructionsEn: config.instructionsEn, prepared };
}
