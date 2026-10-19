// Run after reviewing new source content and its Japanese display entries:
// node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/audit-japanese-display.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseStudyMarkup, studyDisplay } from '../src/lib/study-markup.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const load = path => JSON.parse(read(path));
const catalog = load('src/data/japanese-display.json');
const englishCatalog = load('src/data/english-display.json');
const files = { chapter: 'chapters', kana: 'kana', kanji: 'kanji', practice: 'practice' };
const rows = [];
const pages = [];
let nativePanels = 0;
function text(node) { return 'text' in node ? node.text : node.children.map(text).join(''); }
function visit(node, scope, optional = false, header = '') {
  if ('text' in node) {
    if (!optional && header !== 'romaji') rows.push({ scope, source: node.text, display: studyDisplay(['english', 'meaning'].includes(header) ? englishCatalog : catalog, node.text, scope) });
    return;
  }
  if (node.tag === 'details') { nativePanels++; return; }
  if (node.tag === 'table') {
    const headings = [];
    const trs = [];
    function collect(n) {
      if ('text' in n) return;
      if (n.tag === 'th') headings.push(text(n).toLowerCase());
      if (n.tag === 'tr') trs.push(n);
      for (const child of n.children) collect(child);
    }
    collect(node);
    for (const tr of trs) tr.children.filter(n => !('text' in n) && ['td', 'th'].includes(n.tag))
      .forEach((n, i) => visit(n, scope, optional, headings[i] ?? ''));
    return;
  }
  for (const child of node.children) visit(child, scope, optional, header);
}
for (const [kind, file] of Object.entries(files)) for (const page of load(`src/data/${file}.json`)) {
  const scope = `${kind}/${page.ch}`;
  const before = rows.length;
  if (page.intro) rows.push({ scope: scope + '/intro', source: page.intro, display: studyDisplay(catalog, page.intro) });
  for (const section of page.sections) for (const node of parseStudyMarkup(section.html)) visit(node, `${scope}/${section.id}`);
  const own = rows.slice(before);
  pages.push({ page: scope, sections: page.sections.length, textNodes: own.length, japaneseDisplays: own.filter(row => row.display.romaji).length });
}
const sourceHashes = Object.fromEntries([...Object.values(files), 'exercises', 'sentence-exercises'].map(file => [
  `src/data/${file}.json`, createHash('sha256').update(read(`src/data/${file}.json`)).digest('hex'),
]));
const audit = {
  version: 1,
  scope: 'All 14 study pages; lessons, vocabulary, mix-ups, exercises, answers, and introductions. Search keeps all readings visible.',
  method: 'Exact reviewed display strings. Original source text remains available as a romaji hint; native reading/workbook disclosures stay closed until opened.',
  sourceHashes,
  displayHashes: Object.fromEntries(['japanese-display', 'english-display'].map(file => [`src/data/${file}.json`, createHash('sha256').update(read(`src/data/${file}.json`)).digest('hex')])),
  catalogEntries: Object.keys(catalog.texts).length,
  scopedEntries: Object.values(catalog.overrides).reduce((n, entries) => n + Object.keys(entries).length, 0),
  englishReferenceEntries: Object.keys(englishCatalog.texts).length,
  nativePanels,
  pages,
  reviewedSourceNodes: rows.length,
  changedSourceNodes: rows.filter(row => row.display.romaji).length,
};
const auditPath = new URL('../migration/japanese-display-audit.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (JSON.stringify(load('migration/japanese-display-audit.json')) !== JSON.stringify(audit)) throw Error('Study content changed. Review the Japanese catalog, then regenerate migration/japanese-display-audit.json.');
} else writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit, null, 2));
