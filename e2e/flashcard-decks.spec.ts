import { test, expect, visibleMain, library } from "./fixtures";
import { FLASHCARD_KEY, EMPTY_FLASHCARDS, addFlashcard, flashcardId, parseFlashcardDeck, reviewFlashcard, type FlashcardData } from "../src/lib/flashcards";
const student={kind:"vocabulary" as const,japanese:"学生",kana:"がくせい",romaji:"gakusei",meaning:"student",
  source:{key:"chapter:1",label:"Chapter 1 › People",href:"/chapters/1#c1-people-and-jobs"}};
const review=(page: import("./fixtures").Page)=>visibleMain(page).locator("[data-flashcard-review]");
const readData=(page: import("./fixtures").Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!) as FlashcardData,FLASHCARD_KEY);

test("table header saves the whole table once and preserves an already reviewed card",async({page})=>{
  const added=addFlashcard(EMPTY_FLASHCARDS,student,Date.now());
  const before=reviewFlashcard(added,added.cards[0].id,"recognition","good",Date.now()-2*86400000,0);
  await page.addInitScript(({key,data})=>{
    // Init scripts also run on reload. Seed once so the persistence check reads the actual saved deck.
    if (localStorage.getItem(key) === null) localStorage.setItem(key,JSON.stringify(data));
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="japanese-reviewer:flashcards")document.documentElement.dataset.flashcardWrites=String(Number(document.documentElement.dataset.flashcardWrites??0)+1);
      return original.call(this,key,value);
    };
  },{key:FLASHCARD_KEY,data:before});
  await page.goto("/chapters/1");
  const table=visibleMain(page).locator("table").filter({has:page.getByRole("button",{name:"Saved to flashcards: 学生",exact:true})}).first();
  await table.locator("thead").getByRole("button",{name:/^Add all/}).click();
  await expect(table.locator("thead").getByRole("button",{name:/^All \d+ saved$/})).toBeDisabled();
  await expect(table.getByRole("button",{name:/^Add to flashcards:/})).toHaveCount(0);
  const saved=await readData(page);
  expect(saved.cards.length).toBeGreaterThan(1);
  expect(saved.cards.find(card=>card.id===before.cards[0].id)!.progress).toEqual(before.cards[0].progress);
  expect(await page.locator("html").getAttribute("data-flashcard-writes")).toBe("1");
  await page.reload();
  await expect(visibleMain(page).locator("table").filter({has:page.getByRole("button",{name:"Saved to flashcards: 学生",exact:true})}).first().locator("thead").getByRole("button",{name:/^All \d+ saved$/})).toBeDisabled();
  expect(await readData(page)).toEqual(saved);
});

test("all pre-made endpoints return valid source-backed cards and unknown decks return 404",async({request})=>{
  const slugs=[...library.chapters.map(c=>"chapter-"+c.ch),...library.kana.map(c=>"kana-"+c.ch),...library.kanji.map(c=>"kanji-"+c.ch)];
  for(const slug of slugs){
    const response=await request.get("/flashcard-decks/"+slug);
    expect(response.ok()).toBeTruthy();
    const key=slug.replace("-",":"),drafts=parseFlashcardDeck(await response.json(),key);
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every(draft=>draft.source.key===key)).toBeTruthy();
  }
  expect((await request.get("/flashcard-decks/missing")).status()).toBe(404);
});

test("an empty browser can select multiple decks; only selected decks load and shared cards merge",async({page,request})=>{
  const requests:string[]=[];page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/flashcard-decks/"))requests.push(new URL(request.url()).pathname);});
  await page.goto("/flashcards");
  const picker=visibleMain(page).getByRole("region",{name:"Pre-made decks",exact:true});
  await expect(picker.getByRole("checkbox")).toHaveCount(library.chapters.length+library.kana.length+library.kanji.length);
  await expect(picker.getByRole("button",{name:"Add selected decks and review",exact:true})).toBeDisabled();
  expect(requests).toEqual([]);
  await picker.getByRole("checkbox",{name:/^Kana 1 —/}).check();
  await picker.getByRole("checkbox",{name:/^Kanji 1 —/}).check();
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(review(page)).toBeVisible();
  expect(requests.sort()).toEqual(["/flashcard-decks/kana-1","/flashcard-decks/kanji-1"]);
  const expected=[];
  for(const slug of ["kana-1","kanji-1"])expected.push(...parseFlashcardDeck(await (await request.get("/flashcard-decks/"+slug)).json(),slug.replace("-",":")));
  expect((await readData(page)).cards).toHaveLength(new Set(expected.map(flashcardId)).size);
  expect((await readData(page)).cards.every(card=>card.sources.some(source=>["kana:1","kanji:1"].includes(source.key)))).toBeTruthy();
  const settings=visibleMain(page).getByRole("region",{name:"Review settings",exact:true});
  await expect(settings.getByRole("checkbox",{name:"Kana 1",exact:true})).toBeChecked();
  await expect(settings.getByRole("checkbox",{name:"Kanji 1",exact:true})).toBeChecked();
  const count=(await readData(page)).cards.length;
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(picker.getByRole("status")).toContainText("0 added");
  expect((await readData(page)).cards).toHaveLength(count);
  await page.reload();await expect(review(page)).toBeVisible();expect((await readData(page)).cards).toHaveLength(count);
});

test("shuffled reviews remain stable when revealing and rating advances to a different card",async({page,request})=>{
  // Every possible first card has a source-example heading. Keep this regression independent of shuffle luck.
  const response=await request.get("/flashcard-decks/chapter-3");
  expect(response.ok()).toBeTruthy();
  const chapter=parseFlashcardDeck(await response.json(),"chapter:3");
  const seen=new Set<string>();
  const drafts=chapter.filter(draft=>{
    if(!draft.example||seen.has(draft.japanese))return false;
    seen.add(draft.japanese);return true;
  }).slice(0,3);
  expect(drafts).toHaveLength(3);
  await page.route("**/flashcard-decks/chapter-3",route=>route.fulfill({json:{version:1,key:"chapter:3",drafts}}));
  await page.goto("/flashcards");
  const picker=visibleMain(page).getByRole("region",{name:"Pre-made decks",exact:true});
  await picker.getByRole("checkbox",{name:/^Chapter 3 —/}).check();
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(review(page)).toBeVisible();
  const question=review(page).getByRole("heading",{level:2});
  const prompt=await question.innerText();
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await expect(review(page).getByRole("heading",{name:"Source example",level:3,exact:true})).toBeVisible();
  await expect(question).toHaveText(prompt);
  await visibleMain(page).getByRole("checkbox",{name:"Show romaji",exact:true}).uncheck();
  await expect(question).toHaveText(prompt);
  await review(page).getByRole("button",{name:/^Good/}).click();
  await expect(question).not.toHaveText(prompt);
  await expect(review(page).locator("[data-flashcard-answer]")).toHaveCount(0);
  expect((await readData(page)).daily.recognition).toHaveLength(1);
  await visibleMain(page).getByRole("button",{name:"Shuffle review order",exact:true}).click();
  await expect(question).toHaveCount(1);
  await expect(review(page).locator("[data-flashcard-answer]")).toHaveCount(0);
  expect((await readData(page)).daily.recognition).toHaveLength(1);
});

test("malformed deck response imports nothing and a later retry succeeds",async({page})=>{
  await page.goto("/flashcards");
  const picker=visibleMain(page).getByRole("region",{name:"Pre-made decks",exact:true});
  await picker.getByRole("checkbox",{name:/^Chapter 1 —/}).check();
  await picker.getByRole("checkbox",{name:/^Kana 1 —/}).check();
  await page.route("**/flashcard-decks/chapter-1",route=>route.fulfill({json:{version:1,key:"chapter:1",drafts:[{japanese:"broken"}]}}));
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(picker.getByRole("alert")).toContainText("Nothing was added");
  expect(await page.evaluate(key=>localStorage.getItem(key),FLASHCARD_KEY)).toBeNull();
  await page.unroute("**/flashcard-decks/chapter-1");
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(review(page)).toBeVisible();expect((await readData(page)).cards.length).toBeGreaterThan(0);
});

test("pre-made deck selection fits a phone screen",async({page})=>{
  await page.setViewportSize({width:375,height:800});await page.goto("/flashcards");
  const picker=visibleMain(page).getByRole("region",{name:"Pre-made decks",exact:true});
  await expect(picker).toBeVisible();
  const box=await picker.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
  await picker.getByRole("checkbox",{name:/^Kanji 2 —/}).check();
  await picker.getByRole("button",{name:"Add selected decks and review",exact:true}).click();
  await expect(review(page)).toBeVisible();
});

test("kana character cards reveal a reading and use romaji as their reverse prompt",async({page,request})=>{
  const drafts=parseFlashcardDeck(await (await request.get("/flashcard-decks/kana-1")).json(),"kana:1");
  const character=drafts.find(draft=>draft.kind==="kana")!;
  const initial=addFlashcard(EMPTY_FLASHCARDS,character,Date.now());
  await page.addInitScript(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:FLASHCARD_KEY,data:initial});
  await page.goto("/flashcards");
  await expect(review(page).getByRole("heading",{name:character.japanese,exact:true})).toBeVisible();
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await expect(review(page).getByText("Reading (romaji)",{exact:true})).toBeVisible();
  await expect(review(page).locator("[data-flashcard-answer]")).toContainText(character.romaji);
  await visibleMain(page).getByRole("button",{name:"English → Japanese",exact:true}).click();
  const reverse = review(page).getByRole("heading", {level: 2});
  const reading = reverse.locator("[data-reading-hint=romaji] > span[id]");
  await expect(reading).toBeHidden();
  await reverse.getByRole("button", {name: /^Reveal Romaji/}).click();
  await expect(reading).toBeVisible();
  await expect(reading).toHaveText(character.romaji);
  await expect(review(page).getByText("Romaji → kana",{exact:false})).toBeVisible();
});
