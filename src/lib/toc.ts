// Builds the "On this page" outline from the toc metadata already in the
// data files. Runs on the server while the page is rendered; it never makes
// up anchors, it only arranges the ones that exist. Plain functions with no
// React or data imports, so the tests can run them directly.

export type TocEntry = { a: string; t: string; l: number }; // anchor, text, level

export type TocNode = {
  id: string;       // an anchor that already exists in the page
  label: string;
  children: TocNode[];
};

// Every id="..." in a chunk of HTML, in order
export function anchorIds(html: string): string[] {
  return [...html.matchAll(/\sid=(?:"([^"]+)"|'([^']+)')/g)].map((m) => m[1] ?? m[2]);
}

// Study pages: the five sections are the top level, and each toc entry goes
// under the section whose HTML contains its anchor. Their toc entries are
// all level 3, so levels alone can't say which section they belong to.
// Entries keep their toc order. An entry no section claims stays visible at
// the end rather than disappearing.
export function studyOutline(
  sections: readonly { id: string; title: string; html: string }[],
  toc: readonly TocEntry[]
): TocNode[] {
  const owner = new Map<string, number>();
  sections.forEach((section, i) => {
    for (const id of anchorIds(section.html)) if (!owner.has(id)) owner.set(id, i);
  });
  const nodes: TocNode[] = sections.map((s) => ({ id: s.id, label: s.title, children: [] }));
  const unclaimed: TocNode[] = [];
  for (const entry of toc) {
    const i = owner.get(entry.a);
    const node = { id: entry.a, label: entry.t, children: [] };
    if (i === undefined) unclaimed.push(node);
    else nodes[i].children.push(node);
  }
  return [...nodes, ...unclaimed];
}

// Documents: keep the toc order and nest each heading under the closest
// earlier heading with a smaller level (level 3 under level 2). A heading
// with nothing above it starts at the top level.
export function documentOutline(toc: readonly TocEntry[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: { level: number; node: TocNode }[] = [];
  for (const entry of toc) {
    const node: TocNode = { id: entry.a, label: entry.t, children: [] };
    while (stack.length && stack[stack.length - 1].level >= entry.l) stack.pop();
    (stack.length ? stack[stack.length - 1].node.children : root).push(node);
    stack.push({ level: entry.l, node });
  }
  return root;
}

// How many links an outline has in total
export function countLinks(nodes: readonly TocNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countLinks(node.children), 0);
}

// All anchors in outline order, depth first (used by the tests)
export function flattenIds(nodes: readonly TocNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenIds(node.children)]);
}
