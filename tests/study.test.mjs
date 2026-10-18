// Tests for src/lib/study.ts: the saved format, bookmark changes, and the
// store's fallbacks when localStorage is missing, blocked or full.
// Run from the project root: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_DATA,
  MAX_BOOKMARKS,
  SERVER_SNAPSHOT,
  STORAGE_KEY,
  createStudyStore,
  isBookmarked,
  pageKey,
  parseStudyData,
  recordVisit,
  removeBookmark,
  resolvePlace,
  serializeStudyData,
  studyHref,
  studyPageIndex,
  studyPages,
  toggleBookmark,
} from "../src/lib/study.ts";

const page = { kind: "chapter", id: "3", anchor: null, section: null };
const section = { kind: "chapter", id: "3", anchor: "vocab", section: "Vocabulary" };
const lesson = { kind: "lesson", id: "1", anchor: "d1-question-words", section: "Question words" };

const saved = (data) => JSON.stringify({ version: 1, bookmarks: [], lastVisit: null, ...data });

// A stand-in for window.localStorage
function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

test("links and keys", () => {
  assert.equal(studyHref(page), "/chapters/3");
  assert.equal(studyHref(section), "/chapters/3#vocab");
  assert.equal(studyHref({ kind: "kana", id: "1", anchor: null }), "/kana/1");
  assert.equal(studyHref({ kind: "kanji", id: "1", anchor: "readings" }), "/kanji/1#readings");
  assert.equal(studyHref(lesson), "/lessons/1#d1-question-words");
  assert.equal(pageKey(section), "chapter:3");
});

test("reading: nothing saved, broken JSON and the wrong shape all start empty", () => {
  for (const raw of [null, "", "{not json", "null", "42", '"text"', "[]", "{}", saved({ version: 2 }), saved({ version: "1" })]) {
    assert.deepEqual(parseStudyData(raw), EMPTY_DATA, String(raw));
  }
});

test("reading: a valid file comes back exactly", () => {
  const data = {
    version: 1,
    bookmarks: [
      { ...section, savedAt: 2 },
      { ...page, savedAt: 1 },
    ],
    lastVisit: { ...lesson, visitedAt: 3 },
  };
  assert.deepEqual(parseStudyData(serializeStudyData(data)), data);
});

test("reading: bad entries are dropped one by one, good ones kept", () => {
  const good = { ...section, savedAt: 5 };
  const data = parseStudyData(
    saved({
      bookmarks: [
        good,
        { ...page, kind: "video", savedAt: 1 }, // unknown page type
        { ...page, id: "../../etc", savedAt: 1 }, // not a route value
        { ...page, id: 3, savedAt: 1 }, // number, not string
        { ...section, anchor: "has space", savedAt: 1 }, // not an anchor id
        { ...section, anchor: "x".repeat(101), savedAt: 1 }, // too long
        { ...page, savedAt: -1 }, // bad time
        { ...page, savedAt: "today" },
        { ...page }, // no time
        { ...good, savedAt: 9 }, // duplicate of the first
        null,
        "chapter:3",
        [],
      ],
      lastVisit: { kind: "kanji", id: "1", visitedAt: "yesterday" },
    })
  );
  assert.deepEqual(data.bookmarks, [good]);
  assert.equal(data.lastVisit, null);
});

test("reading: labels are cleaned up, and a whole page never has a section label", () => {
  const data = parseStudyData(
    saved({
      bookmarks: [
        { ...section, section: "  Vocabulary  ", savedAt: 1 },
        { ...section, anchor: "answers", section: 7, savedAt: 1 },
        { ...page, section: "Stray label", savedAt: 1 },
        { ...section, anchor: "long", section: "あ".repeat(500), savedAt: 1 },
      ],
      bookmarksNotes: "extra fields are ignored",
    })
  );
  assert.deepEqual(data.bookmarks.map((b) => b.section), ["Vocabulary", null, null, "あ".repeat(200)]);
});

test("reading: keeps at most MAX_BOOKMARKS", () => {
  const many = Array.from({ length: MAX_BOOKMARKS + 20 }, (_, i) => ({ ...page, id: String(i), savedAt: i }));
  const data = parseStudyData(saved({ bookmarks: many }));
  assert.equal(data.bookmarks.length, MAX_BOOKMARKS);
  assert.equal(data.bookmarks[0].id, "0");
});

test("bookmarks: a page and a section on it are separate, and toggling twice removes", () => {
  let data = toggleBookmark(EMPTY_DATA, page, 1);
  data = toggleBookmark(data, section, 2);
  assert.ok(isBookmarked(data, page));
  assert.ok(isBookmarked(data, section));
  assert.deepEqual(data.bookmarks.map(studyHref), ["/chapters/3#vocab", "/chapters/3"]); // newest first
  assert.equal(data.bookmarks[0].savedAt, 2);

  data = toggleBookmark(data, section, 3);
  assert.ok(!isBookmarked(data, section));
  assert.ok(isBookmarked(data, page));

  data = removeBookmark(data, page);
  assert.deepEqual(data.bookmarks, []);
  assert.deepEqual(EMPTY_DATA.bookmarks, [], "the original data is never changed");
});

test("bookmarks: a new one past the limit drops the oldest", () => {
  let data = EMPTY_DATA;
  for (let i = 0; i < MAX_BOOKMARKS; i++) data = toggleBookmark(data, { ...page, id: String(i) }, i);
  data = toggleBookmark(data, lesson, 999);
  assert.equal(data.bookmarks.length, MAX_BOOKMARKS);
  assert.equal(studyHref(data.bookmarks[0]), studyHref(lesson));
  assert.ok(!isBookmarked(data, { ...page, id: "0" }));
});

test("last visit: replaced each time, bookmarks untouched", () => {
  let data = toggleBookmark(EMPTY_DATA, page, 1);
  data = recordVisit(data, section, 10);
  data = recordVisit(data, lesson, 20);
  assert.deepEqual(data.lastVisit, { ...lesson, visitedAt: 20 });
  assert.equal(data.bookmarks.length, 1);
  assert.equal(recordVisit(EMPTY_DATA, { ...page, section: "x" }, 1).lastVisit.section, null);
});

test("store: reads, saves, and returns the same snapshot until something changes", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: saved({ bookmarks: [{ ...page, savedAt: 1 }] }) });
  const store = createStudyStore({ getStorage: () => storage });
  const first = store.getSnapshot();
  assert.equal(first.ready, true);
  assert.equal(first.saved, true);
  assert.equal(first.data.bookmarks.length, 1);
  assert.equal(store.getSnapshot(), first, "same object, or React would re-render forever");

  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.update((d) => toggleBookmark(d, section, 2));
  assert.equal(calls, 1);
  assert.notEqual(store.getSnapshot(), first);
  assert.deepEqual(parseStudyData(storage.items.get(STORAGE_KEY)).bookmarks.map(studyHref), ["/chapters/3#vocab", "/chapters/3"]);

  unsubscribe();
  store.update((d) => recordVisit(d, page, 3));
  assert.equal(calls, 1);
});

test("store: broken saved data reads as empty, and the next change replaces it", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{oops" });
  const store = createStudyStore({ getStorage: () => storage });
  assert.deepEqual(store.getSnapshot().data, EMPTY_DATA);
  store.update((d) => toggleBookmark(d, page, 1));
  const raw = storage.items.get(STORAGE_KEY);
  assert.equal(JSON.parse(raw).version, 1);
  assert.equal(parseStudyData(raw).bookmarks.length, 1);
});

test("store: no localStorage at all (blocked) works from memory", () => {
  const store = createStudyStore({
    getStorage: () => {
      throw new Error("SecurityError: access is denied");
    },
  });
  assert.equal(store.getSnapshot().saved, false);
  store.update((d) => toggleBookmark(d, page, 1));
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.saved, false);
  assert.ok(isBookmarked(snapshot.data, page));
});

test("store: storage that throws on the very first read starts empty, from memory", () => {
  const store = createStudyStore({
    getStorage: () => ({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    }),
  });
  assert.equal(store.getSnapshot().saved, false);
  assert.deepEqual(store.getSnapshot().data, EMPTY_DATA);
});

test("store: a full or read-only storage keeps the change in memory and says so", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: saved({ bookmarks: [{ ...page, savedAt: 1 }] }) });
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  const store = createStudyStore({ getStorage: () => storage });
  assert.equal(store.getSnapshot().saved, true);
  store.update((d) => toggleBookmark(d, section, 2));
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.saved, false);
  assert.deepEqual(snapshot.data.bookmarks.map(studyHref), ["/chapters/3#vocab", "/chapters/3"], "the old bookmark is kept too");
});

// A storage whose reads can be blocked partway through, like a browser
// that loses access to site data after the page has loaded
function blockableStorage(initial) {
  const storage = memoryStorage(initial);
  const state = { blocked: false };
  const getItem = storage.getItem;
  storage.getItem = (key) => {
    if (state.blocked) throw new Error("SecurityError: access is denied");
    return getItem(key);
  };
  return { storage, state };
}

// Regression: the store used to forget what it had read, so bookmarks vanished
test("store: blocked after a successful read keeps the bookmarks it already read", () => {
  const { storage, state } = blockableStorage({ [STORAGE_KEY]: saved({ bookmarks: [{ ...page, savedAt: 1 }] }) });
  const store = createStudyStore({ getStorage: () => storage });
  const before = store.getSnapshot();
  assert.equal(before.saved, true);
  assert.equal(before.data.bookmarks.length, 1);

  state.blocked = true;
  const after = store.getSnapshot();
  assert.equal(after.saved, false);
  assert.deepEqual(after.data, before.data, "the bookmark is still there");
  assert.equal(store.getSnapshot(), after, "and the snapshot stays the same object while nothing changes");

  store.update((d) => toggleBookmark(d, section, 2));
  assert.deepEqual(store.getSnapshot().data.bookmarks.map(studyHref), ["/chapters/3#vocab", "/chapters/3"]);
});

test("store: blocked after another tab's change keeps that change", () => {
  const { storage, state } = blockableStorage({ [STORAGE_KEY]: saved({ bookmarks: [{ ...page, savedAt: 1 }] }) });
  const store = createStudyStore({ getStorage: () => storage });
  store.getSnapshot();
  storage.items.set(STORAGE_KEY, saved({ bookmarks: [{ ...lesson, savedAt: 2 }, { ...page, savedAt: 1 }] })); // the other tab
  assert.equal(store.getSnapshot().data.bookmarks.length, 2);
  state.blocked = true;
  assert.deepEqual(store.getSnapshot().data.bookmarks.map(studyHref), [studyHref(lesson), "/chapters/3"]);
});

test("store: blocked after the storage was cleared stays empty, nothing comes back", () => {
  const { storage, state } = blockableStorage({ [STORAGE_KEY]: saved({ bookmarks: [{ ...page, savedAt: 1 }] }) });
  const store = createStudyStore({ getStorage: () => storage });
  assert.equal(store.getSnapshot().data.bookmarks.length, 1);
  storage.items.clear(); // localStorage.clear(), here or in another tab
  assert.deepEqual(store.getSnapshot().data, EMPTY_DATA);
  state.blocked = true;
  assert.deepEqual(store.getSnapshot().data, EMPTY_DATA);
});

test("store: blocked after this tab's own change keeps it", () => {
  const { storage, state } = blockableStorage();
  const store = createStudyStore({ getStorage: () => storage });
  store.update((d) => toggleBookmark(d, page, 1));
  state.blocked = true;
  assert.ok(isBookmarked(store.getSnapshot().data, page));
  assert.equal(store.getSnapshot().saved, false);
});

test("store: another tab's change to the same key notifies, other keys don't", () => {
  const storage = memoryStorage();
  const events = new EventTarget();
  const store = createStudyStore({ getStorage: () => storage, getEvents: () => events });
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  const fire = (key) => events.dispatchEvent(Object.assign(new Event("storage"), { key }));

  storage.setItem(STORAGE_KEY, saved({ bookmarks: [{ ...page, savedAt: 1 }] })); // the other tab writes
  fire(STORAGE_KEY);
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().data.bookmarks.length, 1);
  fire("something-else");
  assert.equal(calls, 1);
  fire(null); // localStorage.clear() in another tab
  assert.equal(calls, 2);

  unsubscribe();
  fire(STORAGE_KEY);
  assert.equal(calls, 2);
});

test("server snapshot: not ready and empty, so the server HTML never shows saved data", () => {
  assert.equal(SERVER_SNAPSHOT.ready, false);
  assert.deepEqual(SERVER_SNAPSHOT.data, EMPTY_DATA);
});

test("study pages: one entry per real page, with unique keys and the labels the dashboard shows", () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
  const chapters = load("chapters.json");
  const kana = load("kana.json");
  const kanji = load("kanji.json");
  const { docs } = load("lesson-data.json");
  const pages = studyPages({ chapters, kana, kanji, docs });

  assert.equal(pages.length, chapters.length + kana.length + kanji.length + docs.length);
  assert.equal(new Set(pages.map((p) => p.key)).size, pages.length);
  assert.deepEqual(pages[0], {
    key: "chapter:1",
    label: "Chapter 1",
    title: chapters[0].title,
    anchors: [...chapters[0].sections.map((s) => s.id), ...chapters[0].toc.map((t) => t.a)],
  });
  assert.ok(pages.some((p) => p.key === "kana:1" && p.label === "Kana 1"));
  assert.ok(pages.some((p) => p.key === "kanji:1" && p.label === "Kanji 1"));
  assert.deepEqual(pages.find((p) => p.key === "lesson:1"), {
    key: "lesson:1",
    label: docs[0].kind || "Document",
    title: docs[0].title,
    anchors: docs[0].toc.map((t) => t.a),
  });
  // only ids go to the browser: no lesson HTML, no search entries
  assert.ok(pages.every((p) => Object.keys(p).join() === "key,label,title,anchors"));
  assert.ok(pages.every((p) => p.anchors.every((a) => /^[A-Za-z0-9_-]+$/.test(a))));
  // every page key is a valid saved place, so a bookmark to it survives a reload
  for (const p of pages) {
    const [kind, id] = p.key.split(":");
    const data = parseStudyData(saved({ bookmarks: [{ kind, id, anchor: null, section: null, savedAt: 1 }] }));
    assert.equal(data.bookmarks.length, 1, p.key);
  }
});

test("resolving: a valid section keeps its link and label", () => {
  const index = studyPageIndex([{ key: "chapter:3", label: "Chapter 3", title: "Counters", anchors: ["lessons", "vocab"] }]);
  assert.deepEqual(resolvePlace(section, index), {
    href: "/chapters/3#vocab",
    label: "Chapter 3",
    title: "Counters",
    section: "Vocabulary",
    sectionMissing: false,
  });
  assert.deepEqual(resolvePlace(page, index), {
    href: "/chapters/3",
    label: "Chapter 3",
    title: "Counters",
    section: null,
    sectionMissing: false,
  });
});

test("resolving: a section that no longer exists opens its page, without the old label", () => {
  const index = studyPageIndex([{ key: "chapter:3", label: "Chapter 3", title: "Counters", anchors: ["lessons"] }]);
  assert.deepEqual(resolvePlace(section, index), {
    href: "/chapters/3",
    label: "Chapter 3",
    title: "Counters",
    section: null,
    sectionMissing: true,
  });
});

test("resolving: a page that no longer exists resolves to nothing", () => {
  const index = studyPageIndex([{ key: "chapter:1", label: "Chapter 1", title: "One", anchors: ["vocab"] }]);
  assert.equal(resolvePlace(section, index), null); // chapter 3 is gone
  assert.equal(resolvePlace({ ...section, kind: "kana" }, index), null); // same id, other page type
});

test("resolving: anchors are checked per page, against the real data", () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
  const index = studyPageIndex(
    studyPages({ chapters: load("chapters.json"), kana: load("kana.json"), kanji: load("kanji.json"), docs: load("lesson-data.json").docs })
  );
  assert.equal(resolvePlace(lesson, index).href, "/lessons/1#d1-question-words");
  assert.equal(resolvePlace({ ...section, kind: "kana", id: "1", anchor: "mixups" }, index).href, "/kana/1#mixups");
  // a real anchor, but from another page
  const moved = resolvePlace({ ...lesson, id: "2" }, index);
  assert.equal(moved.href, "/lessons/2");
  assert.equal(moved.sectionMissing, true);
});
