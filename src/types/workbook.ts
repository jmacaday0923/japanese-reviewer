export type WorkbookQuestion = {
  id: string; number: number; mode: "choice" | "text" | "order" | "self";
  prompt: string; romaji?: string; model: string; whyJa: string; whyEn: string;
  source: { printedPage: number; number: number };
  accepted?: string[];
  choices?: { id: string; text: string }[]; correctChoiceId?: string; acceptedChoiceIds?: string[];
  tokens?: string[]; acceptedOrders?: number[][]; before?: string; after?: string;
};
export type WorkbookSet = {
  id: string; chapter: string; title: string; sourcePage: number; heading: string;
  instructionsJa: string; instructionsEn?: string; wordBank?: string[]; passageId?: string; questions: WorkbookQuestion[];
};
export type WorkbookBank = { version: 1; chapters: { chapter: string; sets: WorkbookSet[] }[] };
