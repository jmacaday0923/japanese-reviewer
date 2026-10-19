// Parser for this repository's trusted, balanced study HTML, not arbitrary HTML.
// It keeps attributes and whitespace and never interprets lesson text as code.
export type StudyNode = { tag: string; attrs: Record<string, string>; children: StudyNode[] } | { text: string };

export function decodeStudyText(text: string): string {
  return text.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#([0-9]+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, "\u00a0").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function parseStudyMarkup(html: string): StudyNode[] {
  const root = { tag: "root", attrs: {}, children: [] as StudyNode[] };
  const stack = [root];
  for (const match of html.matchAll(/<[^>]*>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      const tag = token.slice(2, -1).trim();
      if (stack.length === 1 || stack.pop()!.tag !== tag) throw new Error("Unbalanced study HTML: " + tag);
    } else if (token.startsWith("<")) {
      const tag = /^<([a-z][\w-]*)/i.exec(token)?.[1];
      if (!tag) throw new Error("Unsupported study markup");
      const attrs: Record<string, string> = {};
      for (const attr of token.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[attr[1]] = decodeStudyText(attr[2]);
      const node = { tag, attrs, children: [] as StudyNode[] };
      stack.at(-1)!.children.push(node);
      if (!["br", "hr"].includes(tag)) stack.push(node);
    } else stack.at(-1)!.children.push({ text: decodeStudyText(token) });
  }
  if (stack.length !== 1) throw new Error("Unclosed study HTML");
  return root.children;
}

export type StudyDisplay = { primary: string; romaji?: string };
export type DisplayCatalog = { texts: Record<string, string>; overrides: Record<string, Record<string, string>> };

// Exact, reviewed display strings only. No runtime transliteration or English
// detection: a new source string needs an explicit catalog entry and review.
export function studyDisplay(catalog: DisplayCatalog, text: string, scope = ""): StudyDisplay {
  const primary = catalog.overrides[scope]?.[text] ?? catalog.texts[text];
  return primary === undefined || primary === text ? { primary: text } : { primary, romaji: text };
}
