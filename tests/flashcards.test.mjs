import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  FLASHCARD_KEY, FLASHCARD_SERVER_SNAPSHOT, EMPTY_FLASHCARDS, DEFAULT_NEW_LIMIT, MAX_CARDS,
  flashcardId, parseFlashcardData, addFlashcards, parseFlashcardDeck, shuffledFlashcardIds, addFlashcard, removeFlashcard, restoreFlashcard, removeFlashcards, restoreFlashcards, setNewLimit,
  scheduleReview, reviewFlashcard, reviewQueue, sourceOptions, performance, localDay, createFlashcardStore,
} from "../src/lib/flashcards.ts";

const now = new Date(2026, 9, 19, 12, 0, 0).getTime();
const draft = (name = "学生", extra = {}) => ({
  kind: "vocabulary", japanese: name, kana: "がくせい", romaji: "gakusei", meaning: "student",
  source: {key: "chapter:1", label: "Chapter 1 › People", href: "/chapters/1#people"}, ...extra,
});
const deck = (...names) => names.reduce((data, name) => addFlashcard(data, draft(name), now), EMPTY_FLASHCARDS);
const initial = () => ({dueAt: 0, intervalDays: 0, reviews: 0, lapses: 0, lastReviewedAt: null});
const rate = (data, direction = "recognition", rating = "good", at = now) =>
  reviewFlashcard(data, data.cards[0].id, direction, rating, at, data.cards[0].progress[direction].reviews);
function storage(raw = null) {
  return {raw, blockedRead: false, blockedWrite: false, writes: [],
    getItem(key) {assert.equal(key, FLASHCARD_KEY); if (this.blockedRead) throw Error("blocked"); return this.raw;},
    setItem(key, raw) {assert.equal(key, FLASHCARD_KEY); if (this.blockedWrite) throw Error("full"); this.writes.push(key); this.raw = raw;},
  };
}

test("flashcards: stable content identities distinguish meaning, reading and kind, not source location", () => {
  assert.equal(flashcardId(draft()), flashcardId(draft("学生", {source: {key: "kana:1", label: "Kana", href: "/kana/1#people"}})));
  assert.equal(flashcardId(draft()), flashcardId(draft("学生", {romaji: " ＧＡＫＵＳＥＩ "})));
  for (const extra of [{meaning: "pupil"}, {kana: "other"}, {kind: "kanji"}]) assert.notEqual(flashcardId(draft()), flashcardId(draft("学生", extra)));
});
test("flashcards: duplicate saves merge sources and examples while retaining both direction histories", () => {
  const first = rate(deck("学生"));
  const before = JSON.stringify(first);
  const next = addFlashcard(first, draft("学生", {
    source: {key: "kana:1", label: "Kana 1 › People", href: "/kana/1#people"},
    example: {japanese: "がくせいです。", romaji: "gakusei desu.", english: "I am a student.", href: "/chapters/1#example"},
  }), now + 1);
  assert.equal(next.cards.length, 1);
  assert.equal(next.cards[0].sources.length, 2);
  assert.equal(next.cards[0].examples.length, 1);
  assert.deepEqual(next.cards[0].progress, first.cards[0].progress);
  assert.equal(JSON.stringify(first), before);
  assert.equal(addFlashcard(next, draft(), now + 2), next);
});
test("flashcards: storage round trip retains reviews, examples, sources, limit and today's ledger", () => {
  const data = setNewLimit(rate(deck("学生")), 7);
  assert.deepEqual(parseFlashcardData(JSON.stringify(data)), data);
  assert.equal(FLASHCARD_SERVER_SNAPSHOT.ready, false);
  assert.equal(DEFAULT_NEW_LIMIT, 20);
});
test("flashcards: malformed formats start empty; invalid cards are dropped individually", () => {
  for (const raw of [null, "{", "null", "[]", '{"version":2}']) assert.deepEqual(parseFlashcardData(raw), EMPTY_FLASHCARDS);
  const good = deck("学生").cards[0];
  const invalid = [
    {...good, id: "forged"}, {...good, meaning: ""}, {...good, addedAt: -1},
    {...good, sources: [{key: "chapter:1", label: "bad", href: "javascript:alert(1)"}]},
    {...good, progress: {...good.progress, recall: {...initial(), reviews: -1}}},
    {...good, progress: {...good.progress, recognition: {...initial(), lapses: 1}}},
  ];
  const read = parseFlashcardData(JSON.stringify({...EMPTY_FLASHCARDS, newLimit: 999, cards: [...invalid, good, good]}));
  assert.deepEqual(read.cards, [good]);
  assert.equal(read.newLimit, DEFAULT_NEW_LIMIT);
});
test("flashcards: source links must agree with their chapter key and stay within study routes", () => {
  const bad = ["https://example.com", "/practice/1#answers", "/chapters/1", "/lessons/1#word"];
  for (const href of bad) assert.equal(addFlashcard(EMPTY_FLASHCARDS, draft("学生", {source: {key: "chapter:1", label: "bad", href}}), now), EMPTY_FLASHCARDS);
  assert.equal(addFlashcard(EMPTY_FLASHCARDS, draft("学生", {source: {key: "kana:1", label: "wrong", href: "/chapters/1#people"}}), now), EMPTY_FLASHCARDS);
});
test("scheduler: Again ten minutes, learning Hard thirty minutes, Good one local day and Easy four days", () => {
  assert.equal(scheduleReview(initial(), "again", now).dueAt, now + 600000);
  assert.equal(scheduleReview(initial(), "hard", now).dueAt, now + 1800000);
  assert.equal(scheduleReview(initial(), "hard", now).intervalDays, 0);
  for (const [rating, days] of [["good",1], ["easy",4]]) {
    const result = scheduleReview(initial(), rating, now);
    const expected = new Date(now); expected.setDate(expected.getDate()+days); expected.setHours(0,0,0,0);
    assert.equal(result.dueAt, expected.getTime());
    assert.equal(result.intervalDays, days);
    assert.equal(result.reviews, 1);
    assert.equal(result.lapses, 0);
  }
});
test("scheduler: established intervals grow in rating order and a lapse restarts at ten minutes", () => {
  const previous = {...initial(), intervalDays: 10, reviews: 8};
  assert.equal(scheduleReview(previous, "hard", now).intervalDays, 12);
  assert.equal(scheduleReview(previous, "good", now).intervalDays, 25);
  assert.equal(scheduleReview(previous, "easy", now).intervalDays, 32);
  const lapse = scheduleReview(previous, "again", now);
  assert.equal(lapse.intervalDays, 0); assert.equal(lapse.lapses, 1); assert.equal(lapse.reviews, 9);
  assert.equal(scheduleReview({...previous, intervalDays: 3650}, "easy", now).intervalDays, 3650);
});
test("reviewing: recognition and recall have separate schedules, counts and introduction allowances", () => {
  let data = rate(deck("学生"), "recognition", "again");
  assert.equal(data.cards[0].progress.recognition.reviews, 1);
  assert.deepEqual(data.cards[0].progress.recall, initial());
  assert.equal(data.daily.recognition.length, 1); assert.equal(data.daily.recall.length, 0);
  data = rate(data, "recall", "easy");
  assert.equal(data.cards[0].progress.recall.intervalDays, 4);
  assert.equal(data.cards[0].progress.recognition.intervalDays, 0);
  assert.deepEqual(performance(data.cards,"recognition"), {reviews:1,again:1,remembered:0,percent:0});
  assert.deepEqual(performance(data.cards,"recall"), {reviews:1,again:0,remembered:1,percent:100});
});
test("reviewing: stale/double ratings, missing cards and future cards cannot advance progress", () => {
  const data = deck("学生"), id = data.cards[0].id;
  const next = rate(data);
  assert.equal(reviewFlashcard(next,id,"recognition","easy",now,0), next);
  assert.equal(reviewFlashcard(next,id,"recognition","easy",now,1), next);
  assert.equal(reviewFlashcard(next,"missing","recognition","good",now,0), next);
  assert.equal(reviewFlashcard(data,id,"recognition","good",-1,0), data);
});
test("queue: daily new-card cap is shared across chapter filters and stays separate by direction", () => {
  let data = setNewLimit(deck("一","二","三"),1);
  data = addFlashcard(data,draft("四",{source:{key:"chapter:2",label:"Chapter 2",href:"/chapters/2#word"}}),now);
  assert.equal(reviewQueue(data,"recognition",[],now).newCount,1);
  data = rate(data);
  assert.equal(reviewQueue(data,"recognition",[],now).newCount,0);
  assert.equal(reviewQueue(data,"recognition",["chapter:2"],now).newCount,0);
  assert.equal(reviewQueue(data,"recall",["chapter:2"],now).newCount,1);
  assert.equal(reviewQueue(data,"recognition",[],now).introducedToday,1);
});
test("queue: overdue reviews come before new cards and are never blocked by the new-card cap", () => {
  let data = rate(deck("一","二"));
  const due = data.cards[0].progress.recognition.dueAt;
  data = setNewLimit(data,0);
  const queue = reviewQueue(data,"recognition",[],due);
  assert.equal(queue.dueCount,1); assert.equal(queue.newCount,0);
  assert.equal(queue.cards[0].id,data.cards[0].id);
  assert.equal(reviewQueue(data,"recognition",[],due-1).cards.length,0);
  assert.equal(reviewQueue(data,"recognition",[],due-1).nextDueAt,due);
});
test("queue: Again returns only when its learning delay elapses", () => {
  const data = rate(deck("学生"),"recognition","again");
  assert.equal(reviewQueue(data,"recognition",[],now+599999).dueCount,0);
  assert.equal(reviewQueue(data,"recognition",[],now+600000).dueCount,1);
});
test("queue: a new local day resets the global allowance without resetting reviews", () => {
  let data = rate(setNewLimit(deck("一","二"),1));
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1);
  const queue = reviewQueue(data,"recognition",[],tomorrow.getTime());
  assert.equal(queue.introducedToday,0); assert.equal(queue.newCount,1); assert.equal(queue.dueCount,1);
  data = reviewFlashcard(data,data.cards[1].id,"recognition","good",tomorrow.getTime(),0);
  assert.equal(data.daily.day,localDay(tomorrow.getTime()));
  assert.deepEqual(data.daily.recognition,[data.cards[1].id]);
});
test("queue: duplicate source memberships do not duplicate cards in a multiple-chapter selection", () => {
  let data = deck("学生");
  data = addFlashcard(data,draft("学生",{source:{key:"chapter:2",label:"Chapter 2",href:"/chapters/2#word"}}),now);
  assert.equal(reviewQueue(data,"recognition",["chapter:1","chapter:2"],now).cards.length,1);
  assert.equal(reviewQueue(data,"recognition",["kanji:1"],now).cards.length,0);
  assert.deepEqual(sourceOptions(data.cards).map(s=>s.key),["chapter:1","chapter:2"]);
});
test("remove and undo retain scheduling and do not free today's introduction allowance", () => {
  const data = rate(setNewLimit(deck("一","二"),1)), saved = data.cards[0];
  const removed = removeFlashcard(data,saved.id);
  assert.equal(removed.cards.length,1); assert.equal(removed.daily.recognition.length,1);
  assert.equal(reviewQueue(removed,"recognition",[],now).newCount,0);
  assert.deepEqual(restoreFlashcard(removed,saved).cards.find(card=>card.id===saved.id),saved);
  assert.equal(removeFlashcard(removed,"missing"),removed);
});
test("re-adding the same removed card counts as the same daily introduction", () => {
  const reviewed = rate(setNewLimit(deck("学生"),1));
  const removed = removeFlashcard(reviewed,reviewed.cards[0].id);
  const restored = addFlashcard(removed,draft(),now+1);
  assert.equal(reviewQueue(restored,"recognition",[],now+1).newCount,1);
  assert.equal(rate(restored).daily.recognition.length,1);
});
test("new-card limit accepts 0 through 200 and rejects invalid changes", () => {
  for (const value of [-1,201,1.5,NaN,Infinity]) assert.equal(setNewLimit(EMPTY_FLASHCARDS,value),EMPTY_FLASHCARDS);
  assert.equal(setNewLimit(EMPTY_FLASHCARDS,0).newLimit,0);
  assert.equal(setNewLimit(EMPTY_FLASHCARDS,200).newLimit,200);
});
test("deck capacity is enforced without dropping existing cards", () => {
  const data = {...EMPTY_FLASHCARDS,cards:Array.from({length:MAX_CARDS},(_,i)=>({...deck("word"+i).cards[0]}))};
  assert.equal(addFlashcard(data,draft("new"),now),data);
});
test("store: updates persist only the flashcard key and server snapshots stay empty", () => {
  const disk = storage(), store = createFlashcardStore({getStorage:()=>disk});
  let notices=0; const stop=store.subscribe(()=>notices++);
  const first=store.getSnapshot(); assert.equal(first,store.getSnapshot());
  store.update(data=>addFlashcard(data,draft(),now));
  assert.equal(notices,1); assert.deepEqual(disk.writes,[FLASHCARD_KEY]);
  assert.equal(createFlashcardStore({getStorage:()=>disk}).getSnapshot().data.cards.length,1);
  assert.equal(FLASHCARD_SERVER_SNAPSHOT.data.cards.length,0);
  stop();
});
test("store: blocked storage and quota errors keep an in-memory deck and review progress", () => {
  const blocked=createFlashcardStore({getStorage:()=>{throw Error("blocked");}});
  blocked.update(data=>addFlashcard(data,draft(),now));
  assert.equal(blocked.getSnapshot().saved,false); assert.equal(blocked.getSnapshot().data.cards.length,1);
  const disk=storage(), store=createFlashcardStore({getStorage:()=>disk});
  store.update(data=>addFlashcard(data,draft(),now)); disk.blockedWrite=true;
  store.update(data=>rate(data));
  assert.equal(store.getSnapshot().saved,false); assert.equal(store.getSnapshot().data.cards[0].progress.recognition.reviews,1);
  const reading=storage(JSON.stringify(deck("学生"))), readStore=createFlashcardStore({getStorage:()=>reading});
  readStore.getSnapshot(); reading.blockedRead=true;
  assert.equal(readStore.getSnapshot().saved,false);
  assert.equal(readStore.getSnapshot().data.cards.length,1);
});
test("store: same-key cross-tab changes, clearing and unsubscribe are handled", () => {
  const disk=storage(), events=new EventTarget(), store=createFlashcardStore({getStorage:()=>disk,getEvents:()=>events});
  let notices=0;const stop=store.subscribe(()=>notices++);
  const send=(key)=>{const event=new Event("storage");Object.defineProperty(event,"key",{value:key});events.dispatchEvent(event);};
  store.getSnapshot();disk.raw=JSON.stringify(deck("学生"));send(FLASHCARD_KEY);
  assert.equal(notices,1);assert.equal(store.getSnapshot().data.cards.length,1);
  send("japanese-reviewer:reading-visibility");assert.equal(notices,1);
  disk.raw=null;send(null);assert.equal(store.getSnapshot().data.cards.length,0);
  stop();send(FLASHCARD_KEY);assert.equal(notices,2);
});

test("scheduler: day reviews follow local midnight through daylight-saving transitions",()=>{
  const url=new URL("../src/lib/flashcards.ts",import.meta.url).href;
  const script='import assert from "node:assert/strict"; import {scheduleReview} from '+JSON.stringify(url)+';'
    +'const p={dueAt:0,intervalDays:0,reviews:0,lapses:0,lastReviewedAt:null};'
    +'for(const [start,hours] of [["2026-03-08T00:00:00-05:00",23],["2026-11-01T00:00:00-04:00",25]]) {'
    +'const now=new Date(start).getTime(), next=scheduleReview(p,"good",now);'
    +'assert.equal(next.dueAt-now,hours*3600000);assert.equal(new Date(next.dueAt).getHours(),0); }';
  execFileSync(process.execPath,["--experimental-strip-types","--disable-warning=MODULE_TYPELESS_PACKAGE_JSON","--input-type=module","-e",script],
    {env:{...process.env,TZ:"America/New_York"},stdio:"pipe"});
});


test("bulk save: one write merges all sources, deduplicates rows and preserves both histories", () => {
  const original = rate(rate(deck("学生")), "recall", "easy");
  const before = JSON.stringify(original), disk = storage(before), store = createFlashcardStore({getStorage:()=>disk});
  const other = draft("学生", {source:{key:"kana:1",label:"Kana 1",href:"/kana/1#people"}});
  let result;
  store.update(data => {result=addFlashcards(data,[draft(),other,other,draft("先生"),draft("先生")],now+1); return result.data;});
  assert.equal(result.added,1); assert.equal(result.existing,1); assert.equal(result.skipped,0);
  assert.equal(disk.writes.length,1); assert.equal(result.data.cards.length,2);
  assert.equal(result.data.cards[0].sources.length,2);
  assert.deepEqual(result.data.cards[0].progress,original.cards[0].progress);
  assert.deepEqual(result.data.daily,original.daily);
  assert.equal(JSON.stringify(original),before);
  const repeat=addFlashcards(result.data,[draft(),other,draft("先生")],now+2);
  assert.equal(repeat.data,result.data);assert.equal(repeat.added,0);assert.equal(repeat.existing,2);
  assert.deepEqual(parseFlashcardData(JSON.stringify(result.data)),result.data);
});
test("bulk save: capacity skips new identities, still merges existing sources and counts duplicates once", () => {
  const cards=Array.from({length:MAX_CARDS-1},(_,i)=>({...deck("word"+i).cards[0]}));
  const data={...EMPTY_FLASHCARDS,cards};
  const result=addFlashcards(data,[draft("new"),draft("overflow"),draft("overflow"),
    draft("word0",{source:{key:"kana:1",label:"Kana 1",href:"/kana/1#people"}})],now);
  assert.equal(result.added,1);assert.equal(result.existing,1);assert.equal(result.skipped,1);
  assert.equal(result.data.cards.length,MAX_CARDS);assert.equal(result.data.cards[0].sources.length,2);
  assert.equal(data.cards[0].sources.length,1);
});
test("bulk save: invalid rows are skipped and blocked storage retains the complete batch in memory", () => {
  const store=createFlashcardStore({getStorage:()=>{throw Error("blocked");}});
  store.update(data=>addFlashcards(data,[draft(),draft("先生"),draft("bad",{meaning:""})],now).data);
  assert.equal(store.getSnapshot().saved,false);assert.equal(store.getSnapshot().data.cards.length,2);
  const invalid=addFlashcards(EMPTY_FLASHCARDS,[draft()],-1);
  assert.equal(invalid.data,EMPTY_FLASHCARDS);assert.equal(invalid.skipped,1);
});
test("deck payload: validates version, selected source key and every row before importing", () => {
  const value={version:1,key:"chapter:1",drafts:[draft()]};
  assert.deepEqual(parseFlashcardDeck(value,"chapter:1"),[draft()]);
  for(const invalid of [null,{}, {...value,version:2}, {...value,key:"kana:1"},
    {...value,drafts:[draft(),draft("bad",{meaning:""})]},
    {...value,drafts:[draft("bad",{source:{key:"chapter:1",label:"bad",href:"https://example.com"}})]},
    {...value,drafts:[draft("bad",{example:{href:"javascript:bad"}})]}]) {
    assert.throws(()=>parseFlashcardDeck(invalid,"chapter:1"));
  }
});
test("shuffle: stable permutation for a seed, different seeds vary the order, no mutation or duplicates", () => {
  const data=deck(...Array.from({length:40},(_,i)=>"word"+i)), before=JSON.stringify(data);
  const first=shuffledFlashcardIds(data.cards,12345);
  assert.deepEqual(first,shuffledFlashcardIds(data.cards,12345));
  assert.deepEqual([...first].sort(),data.cards.map(card=>card.id).sort());
  assert.notDeepEqual(first,shuffledFlashcardIds(data.cards,98765));
  assert.equal(JSON.stringify(data),before);
  assert.deepEqual(shuffledFlashcardIds([],123),[]);
});
test("random queue: samples the whole selected pool before the daily cap and advances without repeats", () => {
  let data=setNewLimit(deck(...Array.from({length:30},(_,i)=>"word"+i)),5);
  const order=shuffledFlashcardIds(data.cards,12345);
  const first=reviewQueue(data,"recognition",["chapter:1"],now,order);
  assert.deepEqual(first.cards.map(card=>card.id),order.slice(0,5));
  assert.notDeepEqual(first.cards.map(card=>card.id),data.cards.slice(0,5).map(card=>card.id));
  const seen=[];
  for(let i=0;i<5;i++) {
    const current=reviewQueue(data,"recognition",[],now,shuffledFlashcardIds(data.cards,12345)).cards[0];
    seen.push(current.id);
    data=reviewFlashcard(data,current.id,"recognition","good",now,0);
  }
  assert.deepEqual(seen,order.slice(0,5));assert.equal(new Set(seen).size,5);
  assert.equal(reviewQueue(data,"recognition",[],now,order).cards.length,0);
  assert.equal(reviewQueue(data,"recognition",[],now,shuffledFlashcardIds(data.cards,54321)).cards.length,0);
  assert.equal(reviewQueue(data,"recall",[],now,order).newCount,5);
});
test("random queue: due cards stay ahead of new cards; future reviews and unrelated chapters stay out", () => {
  let data=rate(deck("学生","先生"),"recognition","again");
  data=addFlashcard(data,draft("お茶",{source:{key:"chapter:2",label:"Chapter 2",href:"/chapters/2#words"}}),now);
  const order=data.cards.slice().reverse().map(card=>card.id);
  const before=reviewQueue(data,"recognition",["chapter:1"],now,order);
  assert.deepEqual(before.cards.map(card=>card.japanese),["先生"]);
  const after=reviewQueue(data,"recognition",["chapter:1"],now+600000,order);
  assert.deepEqual(after.cards.map(card=>card.japanese),["学生","先生"]);
  assert.equal(reviewQueue(setNewLimit(data,0),"recognition",[],now+600000,order).cards.length,1);
});

test("removing several cards is one change and restoring brings back their histories without duplicates", () => {
  const now = 1_700_000_000_000;
  const a = { kind: "vocabulary", japanese: "学生", kana: "がくせい", romaji: "gakusei", meaning: "student", source: { key: "chapter:1", label: "Chapter 1", href: "/chapters/1#vocab" } };
  const b = { ...a, japanese: "先生", kana: "せんせい", romaji: "sensei", meaning: "teacher" };
  const c = { ...a, japanese: "医者", kana: "いしゃ", romaji: "isha", meaning: "doctor" };
  let data = addFlashcards(EMPTY_FLASHCARDS, [a, b, c], now).data;
  data = reviewFlashcard(data, data.cards[0].id, "recognition", "good", now, 0);
  const gone = data.cards.slice(0, 2);
  const after = removeFlashcards(data, gone.map(card => card.id));
  assert.deepEqual(after.cards.map(card => card.japanese), ["医者"]);
  assert.equal(removeFlashcards(after, ["missing"]), after);
  const back = restoreFlashcards(after, gone);
  assert.equal(back.cards.length, 3);
  assert.deepEqual(back.cards.find(card => card.japanese === "学生").progress, data.cards[0].progress);
  assert.equal(restoreFlashcards(back, gone), back);
});
