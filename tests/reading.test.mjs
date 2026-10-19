import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_VISIBILITY, READING_KEY, READING_SERVER_SNAPSHOT, createReadingStore, parseReadingVisibility,
} from "../src/lib/reading-preferences.ts";
import { cellText, columnKind, cellKind, rowLabel, splitReadingContent } from "../src/lib/reading-content.ts";

const save = (show) => JSON.stringify({ version: 1, show });
function fakeStorage(raw = null) {
  return {
    raw, failRead: false, failWrite: false, writes: [],
    getItem(key) { assert.equal(key, READING_KEY); if (this.failRead) throw Error("blocked"); return this.raw; },
    setItem(key, value) { assert.equal(key, READING_KEY); if (this.failWrite) throw Error("full"); this.raw = value; this.writes.push(key); },
  };
}

test("reading preferences: defaults, valid values, invalid data and versions", () => {
  for (const raw of [null, "{", "null", "[]", '{"version":2}', '{"version":1,"show":{"romaji":false}}']) {
    assert.deepEqual(parseReadingVisibility(raw), DEFAULT_VISIBILITY);
  }
  const show = { romaji: false, english: true, kana: true };
  assert.deepEqual(parseReadingVisibility(save(show)), show);
  assert.equal(READING_SERVER_SNAPSHOT.ready, false);
});

test("reading store: independent choices persist, stable snapshots, reveals reset", () => {
  const storage = fakeStorage();
  const store = createReadingStore({ getStorage: () => storage });
  let notices = 0;
  const stop = store.subscribe(() => notices++);
  const first = store.getSnapshot();
  assert.equal(first, store.getSnapshot());
  store.setShown("romaji", true);
  store.setShown("romaji", false);
  assert.deepEqual(store.getSnapshot().show, { romaji: false, english: true, kana: true });
  const rev = store.getSnapshot().revision;
  store.hideRevealed();
  assert.equal(store.getSnapshot().revision, rev + 1);
  assert.deepEqual(store.getSnapshot().show, { romaji: false, english: true, kana: true });
  store.setShown("english", false);
  store.setShown("kana", false);
  assert.equal(notices, 5);
  assert.ok(storage.writes.every((key) => key === READING_KEY));
  assert.deepEqual(createReadingStore({ getStorage: () => storage }).getSnapshot().show, { romaji: false, english: false, kana: false });
  stop();
});

test("reading store: blocked storage, failed writes, and later failed reads retain choices", () => {
  const blocked = createReadingStore({ getStorage: () => { throw Error("blocked"); } });
  blocked.setShown("english", false);
  assert.equal(blocked.getSnapshot().saved, false);
  assert.equal(blocked.getSnapshot().show.english, false);
  const storage = fakeStorage(save({ romaji: false, english: true }));
  const store = createReadingStore({ getStorage: () => storage });
  assert.equal(store.getSnapshot().show.romaji, false);
  storage.failRead = true;
  assert.equal(store.getSnapshot().show.romaji, false);
  assert.equal(store.getSnapshot().saved, false);
  store.setShown("english", false);
  assert.equal(store.getSnapshot().show.english, false);
  const full = fakeStorage();
  const failed = createReadingStore({ getStorage: () => full });
  full.failWrite = true;
  failed.setShown("romaji", true);
  assert.equal(failed.getSnapshot().show.romaji, true);
  assert.equal(failed.getSnapshot().saved, false);
});

test("reading store: cross-tab changes and clearing; other keys and cleanup", () => {
  const storage = fakeStorage();
  const events = new EventTarget();
  const store = createReadingStore({ getStorage: () => storage, getEvents: () => events });
  let calls = 0;
  const stop = store.subscribe(() => calls++);
  store.getSnapshot();
  const send = (key) => { const event = new Event("storage"); Object.defineProperty(event, "key", { value: key }); events.dispatchEvent(event); };
  storage.raw = save({ romaji: false, english: true });
  send(READING_KEY);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().show.romaji, false);
  send("japanese-reviewer:study");
  assert.equal(calls, 1);
  storage.raw = null;
  send(null);
  assert.deepEqual(store.getSnapshot().show, DEFAULT_VISIBILITY);
  stop(); send(READING_KEY);
  assert.equal(calls, 2);
});

test("hint classification: independent romaji, English and kana readings; visible kanji and prompts", () => {
  assert.equal(columnKind("Romaji"), "romaji");
  assert.equal(columnKind("English"), "english");
  assert.equal(columnKind("Meaning"), "english");
  for (const header of ["On'yomi", "Kun'yomi", "Reading", "Readings", "Exit reading", "Japanese reading", "Chinese reading"]) {
    assert.equal(columnKind(header), "kana", header);
  }
  for (const header of ["Kana", "Kanji", "Word", "Hiragana", "Katakana", "Question", "Your answer"]) {
    assert.equal(columnKind(header), null, header);
  }
  assert.equal(cellKind(["Kana", "Kanji"], ["がっこう", "学校"], 0), "kana");
  assert.equal(cellKind(["Kana", "Kanji"], ["ところ / ばしょ", "所 / 場所"], 0), "kana");
  assert.equal(cellKind(["Word", "Kana"], ["学校", "がっこう"], 1), "kana");
  assert.equal(cellKind(["Kana", "Kanji"], ["トイレ", ""], 0), null);
  assert.equal(cellKind(["Word", "Kana"], ["トイレ", "トイレ"], 1), null);
  assert.equal(cellKind(["Kana", "Romaji"], ["ガ", "ga"], 0), null);
  assert.equal(cellKind(["Word", "Kana"], ["学校", "がっこう"], 0), null);
  assert.equal(cellText("A &amp; B &#x5B66;"), "A & B 学");
});

test("reading preferences: retain both prior formats and prefer an explicit kana choice", () => {
  const two = { romaji: false, english: false };
  assert.deepEqual(parseReadingVisibility(save(two)), { ...two, kana: true });
  for (const furigana of [true, false]) {
    assert.deepEqual(parseReadingVisibility(save({ ...two, furigana })), { ...two, kana: furigana });
  }
  assert.deepEqual(parseReadingVisibility(save({ ...two, furigana: "obsolete" })), { ...two, kana: true });
  assert.deepEqual(parseReadingVisibility(save({ ...two, furigana: true, kana: false })), { ...two, kana: false });
  const storage = fakeStorage(save({ ...two, furigana: false }));
  const store = createReadingStore({ getStorage: () => storage });
  assert.deepEqual(store.getSnapshot().show, { ...two, kana: false });
  store.setShown("english", true);
  assert.deepEqual(JSON.parse(storage.raw), { version: 2, show: { romaji: false, english: true, kana: false } });
});

test("reading-only tables become controllable without changing kanji or kana text", () => {
  const html = '<div class="tw"><table><thead><tr><th>Word</th><th>Kana</th></tr></thead><tbody><tr><td>学校</td><td>がっこう</td></tr></tbody></table></div>';
  assert.deepEqual(splitReadingContent(html), [{
    type: "table", table: { headers: ["Word", "Kana"], rows: [["学校", "がっこう"]] },
  }]);
  const kanaOnly = html.replace("学校", "トイレ").replace("がっこう", "トイレ");
  assert.deepEqual(splitReadingContent(kanaOnly), [{ type: "html", html: kanaOnly }]);
});

test("row labels use visible words and do not disclose hidden kana readings or meanings", () => {
  assert.equal(rowLabel(["Kana", "Kanji", "Romaji", "English"], ["がっこう", "学校", "gakkou", "school"], "row 1"), "学校");
  assert.equal(rowLabel(["Word", "Kana", "Romaji", "English"], ["一つ", "ひとつ", "hitotsu", "one piece"], "row 2"), "一つ");
  assert.equal(rowLabel(["Meaning", "On'yomi", "Kun'yomi"], ["one", "イチ", "ひと"], "row 3"), "row 3");
  assert.equal(rowLabel(["Kana", "Romaji"], ["ガ", "ga"], "row 4"), "ガ");
});

test("reading parser: source anchors, cell markup, ordinary tables and unknown layouts survive", () => {
  const table = '<div class="tw"><table><thead><tr><th>Japanese</th><th>Romaji</th><th>English</th></tr></thead><tbody><tr><td>学校</td><td><strong>gakkou</strong></td><td>school</td></tr></tbody></table></div>';
  const html = '<h3 id="keep-me">Words</h3>' + table + '<p id="after">After</p>';
  const blocks = splitReadingContent(html);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].html, '<h3 id="keep-me">Words</h3>');
  assert.equal(blocks[1].table.rows[0][1], "<strong>gakkou</strong>");
  assert.equal(blocks[2].html, '<p id="after">After</p>');
  const ordinary = table.replace("<th>Romaji</th>", "<th>Question</th>").replace("<th>English</th>", "<th>Your answer</th>");
  assert.deepEqual(splitReadingContent(ordinary), [{ type: "html", html: ordinary }]);
  const malformed = table.replace("<td>school</td>", "");
  assert.deepEqual(splitReadingContent(malformed), [{ type: "html", html: malformed }]);
});

test("all real study content: row counts, header/cell text and anchors are preserved", () => {
  let processed = 0;
  for (const file of ["chapters.json", "kana.json", "kanji.json", "practice.json"]) {
    const pages = JSON.parse(readFileSync(new URL("../src/data/" + file, import.meta.url), "utf8"));
    for (const page of pages) for (const section of page.sections) {
      const blocks = splitReadingContent(section.html);
      const raw = blocks.filter((b) => b.type === "html").map((b) => b.html).join("");
      const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(ids(raw), ids(section.html), file + ":" + page.ch + ":" + section.id);
      const sourceCells = [...section.html.matchAll(/<(?:td|th)>([\s\S]*?)<\/(?:td|th)>/g)].map((m) => m[1]);
      const reconstructedCells = blocks.flatMap((b) => b.type === "table"
        ? [...b.table.headers, ...b.table.rows.flat()]
        : [...b.html.matchAll(/<(?:td|th)>([\s\S]*?)<\/(?:td|th)>/g)].map((m) => m[1]));
      assert.deepEqual(reconstructedCells, sourceCells);
      for (const b of blocks) if (b.type === "table") {
        processed++;
      }
    }
  }
  assert.ok(processed > 400, "handles the actual reading/translation tables");
});
