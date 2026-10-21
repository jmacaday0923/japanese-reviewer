import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseStudyMarkup, studyDisplay } from '../src/lib/study-markup.ts';
import { splitReadingContent } from '../src/lib/reading-content.ts';
import { DEFAULT_VISIBILITY, parseReadingVisibility, createReadingStore } from '../src/lib/reading-preferences.ts';
const load = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const catalog = load('src/data/japanese-display.json');
const audit = load('migration/japanese-display-audit.json');
const display = (text, scope) => studyDisplay(catalog, text, scope);
const scripts = ['chapters', 'kana', 'kanji', 'practice'];
const source = scripts.flatMap(file => load(`src/data/${file}.json`));

// Source integrity protects flashcard IDs, search, answer acceptance and the
// sentence bank's source references while the UI gains Japanese prompts.
test('Japanese display audit includes every current study page and source bank', () => {
  assert.equal(audit.pages.length, source.length);
  assert.equal(audit.pages.reduce((n, p) => n + p.sections, 0), source.reduce((n, p) => n + p.sections.length, 0));
  assert.ok(audit.changedSourceNodes > 7000);
  assert.ok(audit.pages.every(page => page.nativeJapaneseNodes > 0));
  for (const [path, hash] of Object.entries(audit.sourceHashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex'), hash, path + ' needs a content review');
  }
  execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/audit-japanese-display.mjs', '--check'], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});

test('all actual markup blocks and table cells parse with their IDs and text intact', () => {
  let tables = 0;
  const flatten = nodes => nodes.map(n => 'text' in n ? n.text : flatten(n.children)).join('');
  for (const page of source) for (const section of page.sections) {
    for (const block of splitReadingContent(section.html)) {
      if (block.type === 'html') parseStudyMarkup(block.html);
      else {
        tables++;
        for (const cell of [...block.table.headers, ...block.table.rows.flat()]) {
          const parsed = parseStudyMarkup(cell);
          assert.equal(flatten(parsed), cell.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, '\u00a0'));
        }
      }
    }
  }
  assert.ok(tables > 400);
  assert.throws(() => parseStudyMarkup('<p><strong>broken</p>'), /Unbalanced/);
  assert.throws(() => parseStudyMarkup('<p>unfinished'), /Unclosed/);
});

test('the reported Chapter 8 questions use Japanese and retain English task cues', () => {
  for (const [roman, japanese] of [
    ['kesa nani o tabemashita ka. (bread)', 'けさ、なにをたべましたか。 (bread)'],
    ['doko de ko-hi- o nomimasu ka. (coffee shop)', 'どこでコーヒーをのみますか。 (coffee shop)'],
    ['dare to eiga o mimasu ka. (Ana)', 'だれとえいがをみますか。 (Ana)'],
    ['nani de tabemasu ka. (chopsticks)', 'なにでたべますか。 (chopsticks)'],
    ['dare ni tegami o kakimashita ka. (teacher)', 'だれにてがみをかきましたか。 (teacher)'],
    ['douyatte oshiemasu ka. (in English)', 'どうやっておしえますか。 (in English)'],
    ['nani o yomimasu ka. (newspaper)', 'なにをよみますか。 (newspaper)'],
    ['kutsu o doko de kaimashita ka. (department store)', 'くつをどこでかいましたか。 (department store)'],
  ]) assert.deepEqual(display(roman), { primary: japanese, romaji: roman });
});

test('Japanese-first prompts keep blanks, choices and deliberately incorrect distractors', () => {
  const incorrect = 'ko-hi- o nomita. [コーヒーを のみた。] (Meaning: I drank coffee.)';
  assert.match(display(incorrect).primary, /のみた/);
  assert.doesNotMatch(display(incorrect).primary, /のんだ/);
  assert.equal(display('4 wa (わ)').primary, '4 わ');
  for (const [old, primary] of Object.entries(catalog.texts)) {
    const choice = old.match(/^([1-4](?: [1-4])*[.:]? )/);
    if (choice) assert.ok(primary.startsWith(choice[1]), old + ' keeps its answer number/order');
    if (old.includes('____') && !/[ぁ-んァ-ン一-龯]/u.test(old)) {
      assert.equal((primary.match(/_{2,}/g) ?? []).length, (old.match(/_{2,}/g) ?? []).length, old + ' keeps all blanks');
    }
  }
});

test('Kana writing and look-alike prompts remain exercises instead of revealing answers', () => {
  const scope = 'kana/1/exercises';
  assert.equal(display('watashi wa gakusei desu.', scope).primary, 'I am a student.');
  assert.equal(display('ko-hi- o nomimasu.', scope).primary, 'I drink coffee.');
  assert.equal(display('asa (morning)', scope).primary, 'Morning');
  assert.match(display('Which one is shi? (a) し (b) つ', scope).primary, /matches シ/);
  assert.match(display('Which one is shi? (a) シ (b) ツ', scope).primary, /matches し/);
  assert.equal(display('watashi wa gakusei desu.').primary, 'わたしは がくせいです。');
});

test('topic particles, soft endings and negative stems keep their different spellings', () => {
  assert.equal(display('wa (は)').primary, 'は');
  assert.equal(display("On'yomi").primary, '音読み');
  assert.equal(display("Kun'yomi").primary, '訓読み');
  assert.match(display('A noun needs da before wa.').primary, /だ before わ/);
  assert.match(display('suu ends in u, so u becomes wa and then nai is added.').primary, /う becomes わ/);
  assert.doesNotMatch(display('suu ends in u, so u becomes wa and then nai is added.').primary, /becomes は/);
});

test('English directions and meanings are not treated as romaji', () => {
  for (const english of ['Choose a meaning.', 'There are no questions.', 'Read and answer.', 'I am a student.', 'Change the sentence to the past tense.']) {
    assert.deepEqual(display(english), { primary: english });
  }
});

test('old preferences start with romaji hidden and retain English and kana independently', () => {
  assert.deepEqual(DEFAULT_VISIBILITY, { romaji: false, english: true, kana: true });
  assert.deepEqual(parseReadingVisibility(JSON.stringify({ version: 1, show: { romaji: true, english: false, kana: false } })), { romaji: false, english: false, kana: false });
  let raw = JSON.stringify({ version: 1, show: { romaji: true, english: false, furigana: false } });
  const store = createReadingStore({ getStorage: () => ({ getItem: () => raw, setItem: (_, next) => { raw = next; } }) });
  assert.equal(store.getSnapshot().show.romaji, false);
  store.setShown('romaji', true);
  assert.deepEqual(JSON.parse(raw), { version: 2, show: { romaji: true, english: false, kana: false } });
  assert.deepEqual(parseReadingVisibility(raw), { romaji: true, english: false, kana: false });
});


test('romaji grammar references inside English meanings get optional hints without changing ordinary English', () => {
  const english = load('src/data/english-display.json');
  for (const [original, primary] of Object.entries(english.texts)) assert.equal(catalog.texts[original], primary, 'English references agree in lessons and flashcards');
  assert.equal(studyDisplay(english, 'casual form of desu').primary, 'casual form of です');
  assert.match(studyDisplay(english, 'I listen to music. (masu form, formal)').primary, /ます form/);
  assert.deepEqual(studyDisplay(english, 'I am a student.'), { primary: 'I am a student.' });
  assert.doesNotMatch(display('9.1 Destination e or ni, and origin kara kimashita (bunkei 9.1)').primary, /9。1/);
});

test('sound notes distinguish vowels from particle spelling and preserve English time notation', () => {
  const kana = load('src/data/kana.json')[0];
  const paragraph = kana.sections.find(s => s.id === 'lessons').html.match(/<p>(Three hiragana change their sound.*?)<\/p>/)[1];
  assert.match(display(paragraph).primary, /は is read わ、へ is read え and を is read お/);
  assert.equal(display('o', 'kana/1/answers').primary, 'お');
  assert.match(display('4.10 Time Expression made').primary, /まで/);
  assert.equal(display('I made a reservation yesterday. / I did not make a reservation yesterday.').primary, 'I made a reservation yesterday. / I did not make a reservation yesterday.');
  for (const value of [...Object.values(catalog.texts), ...Object.values(load('src/data/english-display.json').texts)]) assert.doesNotMatch(value, /[をお]'clock|9。1/);
});
