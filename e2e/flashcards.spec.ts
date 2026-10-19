import { test, expect, visibleMain, type Page } from "./fixtures";
import { addFlashcard, EMPTY_FLASHCARDS, FLASHCARD_KEY, reviewFlashcard, setNewLimit, type FlashcardData, type FlashcardDraft } from "../src/lib/flashcards";
const READING_KEY = "japanese-reviewer:reading-visibility";
const student: FlashcardDraft = {
  kind: "vocabulary", japanese: "学生", kana: "がくせい", romaji: "gakusei", meaning: "student",
  source: {key:"chapter:1",label:"Chapter 1 › People",href:"/chapters/1#c1-people-and-jobs"},
  example:{japanese:"わたしは がくせいです。",romaji:"watashi wa gakusei desu.",english:"I am a student.",href:"/chapters/1#c1-1-1-a-wa-b-desu"},
};
const tea: FlashcardDraft = {
  kind:"vocabulary",japanese:"お茶",kana:"おちゃ",romaji:"ocha",meaning:"tea",
  source:{key:"chapter:2",label:"Chapter 2 › Words",href:"/chapters/2#vocab"},
};
const deck = () => addFlashcard(EMPTY_FLASHCARDS,student,Date.now());
async function seed(page: Page, data: FlashcardData) {
  await page.addInitScript(({key,raw}) => localStorage.setItem(key,raw), {key:FLASHCARD_KEY,raw:JSON.stringify(data)});
}
async function data(page: Page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as FlashcardData,FLASHCARD_KEY); }
const review = (page: Page) => visibleMain(page).locator("[data-flashcard-review]");
test.use({viewport:{width:1440,height:900}});

test("save vocabulary, kanji and sentences from lessons; duplicates retain every source and survive reload",async({page})=>{
  await page.goto("/chapters/1");
  await visibleMain(page).getByRole("button",{name:"Add to flashcards: 学生",exact:true}).first().click();
  await expect(visibleMain(page).getByRole("button",{name:"Saved to flashcards: 学生",exact:true}).first()).toBeDisabled();
  await page.goto("/kana/1");
  await visibleMain(page).getByRole("button",{name:"Add to flashcards: 学生",exact:true}).first().click();
  expect((await data(page)).cards).toHaveLength(1);
  expect((await data(page)).cards[0].sources).toHaveLength(2);
  await page.goto("/kanji/1");
  await visibleMain(page).getByRole("button",{name:"Add to flashcards: 一",exact:true}).first().click();
  await page.goto("/chapters/1");
  await visibleMain(page).getByRole("button",{name:"Add to flashcards: わたしは がくせいです。",exact:true}).first().click();
  expect((await data(page)).cards.map(card=>card.kind).sort()).toEqual(["kanji","sentence","vocabulary"]);
  await page.goto("/flashcards");
  await expect(review(page).getByRole("heading",{name:"学生",exact:true})).toBeVisible();
  await expect(review(page).locator("[data-flashcard-answer]")).toHaveCount(0);
  await expect(review(page).getByRole("group",{name:"Rate your recall"})).toHaveCount(0);
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await expect(review(page).locator("[data-flashcard-answer]")).toBeFocused();
  await expect(review(page).getByText("student",{exact:true})).toBeVisible();
  await expect(review(page).getByText("がくせい",{exact:true})).toBeVisible();
  await expect(review(page).getByText("わたしは がくせいです。",{exact:true})).toBeVisible();
  await review(page).getByRole("button",{name:/^Good/}).click();
  await expect(review(page).getByRole("button",{name:"Reveal answer",exact:true})).toBeFocused();
  await page.reload();
  await expect(visibleMain(page).getByRole("heading",{name:"Flashcards",exact:true})).toBeVisible();
  const saved=await data(page);
  expect(saved.cards).toHaveLength(3);
  expect(saved.cards.find(card=>card.japanese==="学生")!.progress.recognition.reviews).toBe(1);
});

test("review directions hide answers until revealed and keep independent ratings and schedules",async({page})=>{
  await seed(page,deck());
  await page.goto("/flashcards");
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await review(page).getByRole("button",{name:/^Again/}).click();
  await expect(visibleMain(page).getByRole("region",{name:"Queue complete"})).toBeVisible();
  await visibleMain(page).getByRole("button",{name:"English → Japanese",exact:true}).click();
  await expect(review(page).getByRole("heading",{name:"student",exact:true})).toBeVisible();
  await expect(review(page).getByText("学生",{exact:true})).toHaveCount(0);
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await expect(review(page).getByText("学生",{exact:true})).toBeVisible();
  await review(page).getByRole("button",{name:/^Easy/}).click();
  const saved=(await data(page)).cards[0];
  expect(saved.progress.recognition.reviews).toBe(1);
  expect(saved.progress.recognition.lapses).toBe(1);
  expect(saved.progress.recognition.intervalDays).toBe(0);
  expect(saved.progress.recall.reviews).toBe(1);
  expect(saved.progress.recall.intervalDays).toBe(4);
});

test("answer hints respect study toggles while recall prompts always remain readable",async({page})=>{
  await seed(page,deck());
  await page.addInitScript((key)=>localStorage.setItem(key,JSON.stringify({version:1,show:{romaji:false,english:false,kana:false}})),READING_KEY);
  await page.goto("/flashcards");
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  for(const kind of ["kana","romaji","english"]){
    await expect(review(page).locator('[data-reading-hint="'+kind+'"]').first().locator(":scope > span[id]")).toBeHidden();
  }
  await review(page).getByRole("button",{name:"Reveal kana reading for 学生",exact:true}).click();
  await expect(review(page).getByText("がくせい",{exact:true})).toBeVisible();
  await expect(review(page).locator("[data-reading-hint=english]").first().locator(":scope > span[id]")).toBeHidden();
  await visibleMain(page).getByRole("button",{name:"English → Japanese",exact:true}).click();
  await expect(review(page).getByRole("heading",{name:"student",exact:true})).toBeVisible();
  await expect(review(page).locator("[data-flashcard-answer]")).toHaveCount(0);
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await expect(review(page).getByText("学生",{exact:true})).toBeVisible();
  expect(await page.evaluate((key)=>JSON.parse(localStorage.getItem(key)!).show,READING_KEY)).toEqual({romaji:false,english:false,kana:false});
});

test("chapter filters share the daily new-card cap and switching direction has its own cap",async({page})=>{
  await seed(page,setNewLimit(addFlashcard(deck(),tea,Date.now()+1),1));
  await page.goto("/flashcards");
  await visibleMain(page).getByRole("checkbox",{name:"Chapter 2",exact:true}).check();
  await expect(review(page).getByRole("heading",{name:"お茶",exact:true})).toBeVisible();
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await review(page).getByRole("button",{name:/^Good/}).click();
  await visibleMain(page).getByRole("button",{name:"All saved cards",exact:true}).click();
  await expect(review(page)).toHaveCount(0);
  await expect(visibleMain(page).getByText("Your new-card allowance is used.",{exact:false})).toBeVisible();
  await visibleMain(page).getByRole("button",{name:"English → Japanese",exact:true}).click();
  await expect(review(page).getByRole("heading",{name:"student",exact:true})).toBeVisible();
});

test("setting zero new cards still allows due reviews, and Again waits ten minutes",async({page})=>{
  let saved=deck();
  saved=reviewFlashcard(saved,saved.cards[0].id,"recognition","good",Date.now()-2*86400000,0);
  await seed(page,setNewLimit(saved,0));
  await page.goto("/flashcards");
  await expect(review(page).getByRole("heading",{name:"学生",exact:true})).toBeVisible();
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await review(page).getByRole("button",{name:/^Again/}).click();
  await expect(review(page)).toHaveCount(0);
  const state=(await data(page)).cards[0].progress.recognition;
  expect(state.dueAt-state.lastReviewedAt!).toBe(600000);
});

test("storage failure keeps flashcards and reviews in memory while navigating within the tab",async({page})=>{
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==="japanese-reviewer:flashcards")throw new DOMException("blocked","SecurityError");
      return original.call(this,key,value);
    };
  });
  await page.goto("/chapters/1");
  await visibleMain(page).getByRole("button",{name:"Add to flashcards: 学生",exact:true}).first().click();
  await page.locator("aside").first().getByRole("link",{name:"Flashcards",exact:true}).click();
  await expect(review(page).getByRole("heading",{name:"学生",exact:true})).toBeVisible();
  await expect(visibleMain(page).getByText("This browser cannot save flashcards.",{exact:false})).toBeVisible();
  await review(page).getByRole("button",{name:"Reveal answer",exact:true}).click();
  await review(page).getByRole("button",{name:/^Good/}).click();
  await expect(review(page)).toHaveCount(0);
  expect(await page.evaluate((key)=>localStorage.getItem(key),FLASHCARD_KEY)).toBeNull();
});

test("removing and undoing a card preserves its separate review histories",async({page})=>{
  const saved=reviewFlashcard(deck(),deck().cards[0].id,"recognition","good",Date.now()-2*86400000,0);
  await seed(page,saved);await page.goto("/flashcards");
  await visibleMain(page).locator("summary").filter({hasText:"Manage saved cards"}).click();
  await visibleMain(page).getByRole("button",{name:"Remove 学生 from flashcards",exact:true}).click();
  expect((await data(page)).cards).toHaveLength(0);
  await visibleMain(page).getByRole("button",{name:"Undo removal",exact:true}).click();
  expect((await data(page)).cards[0].progress).toEqual(saved.cards[0].progress);
});

test("flashcards is current in the phone menu, and the review card fits a phone viewport",async({page})=>{
  await seed(page,deck());await page.setViewportSize({width:375,height:800});
  await page.goto("/flashcards");
  await expect(review(page)).toBeVisible();
  const box=await review(page).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
  await page.getByRole("button",{name:"Open menu",exact:true}).click();
  const link=page.locator("#mobile-nav").getByRole("link",{name:"Flashcards",exact:true});
  await expect(link).toHaveAttribute("aria-current","true");
  await link.click();await expect(page.locator("#mobile-nav")).toBeHidden();
});
