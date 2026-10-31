import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectFlashcardExamples, sectionFlashcards, lastFlashcardHeading, tableFlashcards } from "../src/lib/flashcard-content.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { EMPTY_FLASHCARDS, addFlashcards, flashcardId, parseFlashcardDeck, addFlashcard, parseFlashcardData } from "../src/lib/flashcards.ts";
const load=(file)=>JSON.parse(readFileSync(new URL("../src/data/"+file+".json",import.meta.url),"utf8"));
const groups=[["chapter","chapters"],["kana","kana"],["kanji","kanji"],["practice","practice"]];
const all=[];
const pageAnchors=new Map();
for(const [kind,file] of groups) for(const page of load(file)){
  const examples=collectFlashcardExamples(page.sections,{kind,id:page.ch});
  pageAnchors.set("/"+(kind==="chapter"?"chapters":kind)+"/"+page.ch,
    new Set([...page.sections.map(s=>s.id),...page.sections.flatMap(s=>[...s.html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]))]));
  for(const section of page.sections){
    const context={kind,id:page.ch,sectionId:section.id,sectionTitle:section.title};
    let heading={id:section.id,title:section.title};
    for(const block of splitReadingContent(section.html)){
      if(block.type==="html"){heading=lastFlashcardHeading(block.html,heading);continue;}
      const drafts=tableFlashcards(block.table,context,heading,examples);
      assert.equal(drafts.length,block.table.rows.length);
      all.push(...drafts.filter(Boolean).map(draft=>({draft,context,heading,table:block.table,examples})));
    }
  }
}
test("flashcard content: all 120 individual kanji, structured vocabulary and sentences are supported",()=>{
  assert.equal(all.filter(item=>item.draft.kind==="kanji" && /^\p{Script=Han}$/u.test(item.draft.japanese)).length,120);
  assert.ok(all.filter(item=>item.draft.kind==="vocabulary").length>1900);
  assert.ok(all.filter(item=>item.draft.kind==="sentence").length>1800);
  assert.ok(all.some(item=>item.context.kind==="chapter"));
  assert.ok(all.some(item=>item.context.kind==="kana"));
  assert.ok(all.some(item=>item.context.kind==="kanji"));
  assert.equal(all.filter(item=>item.context.kind==="practice").length,0);
});
test("flashcard content: each saveable row has a real source anchor and survives persistence validation",()=>{
  for(const {draft} of all){
    const [path,anchor]=draft.source.href.split("#");
    assert.ok(pageAnchors.get(path)?.has(anchor),draft.source.href);
    const data=addFlashcard(EMPTY_FLASHCARDS,draft,1000);
    assert.equal(data.cards.length,1,draft.source.href+" "+draft.japanese);
    assert.deepEqual(parseFlashcardData(JSON.stringify(data)),data);
    assert.ok(draft.japanese.trim()&&draft.meaning.trim());
  }
});
test("flashcard content: all attached examples are actual bilingual rows on the same source page",()=>{
  let examples=0;
  for(const {draft,examples:candidates} of all) if(draft.example){
    examples++;
    assert.ok(candidates.some(item=>JSON.stringify(item)===JSON.stringify(draft.example)));
    const [path,anchor]=draft.example.href.split("#");
    assert.ok(pageAnchors.get(path)?.has(anchor));
    assert.equal(path,draft.source.href.split("#")[0]);
  }
  assert.ok(examples>800);
});
test("flashcard content: student saves as kanji with separate kana, romaji, meaning and a verified sentence",()=>{
  const card=all.find(item=>item.context.kind==="chapter"&&item.draft.japanese==="学生").draft;
  assert.equal(card.kana,"がくせい");
  assert.equal(card.romaji,"gakusei");assert.equal(card.meaning,"student");
  assert.equal(card.example.japanese,"わたしは がくせいです。");
  assert.equal(card.example.english,"I am a student.");
});
test("flashcard content: heading context identifies kanji without guessing its readings",()=>{
  const card=all.find(item=>item.draft.kind==="kanji"&&item.draft.japanese==="一").draft;
  assert.equal(card.meaning,"one");
  assert.equal(card.kana,"On’yomi: イチ · Kun’yomi: ひと");
  assert.equal(card.romaji,"");
  assert.equal(card.example,undefined);
});
test("flashcard content: answers, exercises, unpaired words and unknown layouts are not converted",()=>{
  const context={kind:"chapter",id:"1",sectionId:"answers",sectionTitle:"Answers"};
  const table={headers:["Japanese","Romaji","English"],rows:[["がくせいです。","gakusei desu.","I am a student."]]};
  const heading={id:"test",title:"Test"};
  assert.deepEqual(tableFlashcards(table,context,heading),[null]);
  assert.deepEqual(tableFlashcards(table,{...context,sectionId:"exercises"},heading),[null]);
  assert.deepEqual(tableFlashcards({headers:["Word"],rows:[["学生"]]},{...context,sectionId:"vocab"},heading),[null]);
});
test("flashcard content: matching a vocabulary example respects Latin word boundaries",()=>{
  const table={headers:["Kana","Kanji","Romaji","English"],rows:[["がくせい","学生","gakusei","student"]]};
  const context={kind:"chapter",id:"1",sectionId:"vocab",sectionTitle:"Vocabulary"},heading={id:"word",title:"Word"};
  const other={japanese:"りゅうがくせいです。",romaji:"ryuugakusei desu.",english:"International student.",href:"/chapters/1#other"};
  const match={japanese:"がくせいです。",romaji:"gakusei desu.",english:"I am a student.",href:"/chapters/1#match"};
  assert.equal(tableFlashcards(table,context,heading,[other])[0].example,undefined);
  assert.deepEqual(tableFlashcards(table,context,heading,[other,match])[0].example,match);
});
test("flashcard content: speaker columns and markup do not become part of the Japanese prompt",()=>{
  const context={kind:"chapter",id:"3",sectionId:"lessons",sectionTitle:"Lessons"};
  const card=tableFlashcards({headers:["Speaker","Japanese","Romaji","English"],
    rows:[["Kim","<strong>はい</strong>。","hai.","Yes."]]},context,{id:"dialogue",title:"Dialogue"})[0];
  assert.equal(card.kind,"sentence");assert.equal(card.japanese,"はい。");assert.equal(card.meaning,"Yes.");
});

test("flashcard content: a missing kanji spelling falls back to a kana-only word",()=>{
  const card=tableFlashcards({headers:["Kana","Kanji","Romaji","English"],rows:[["はい","-","hai","yes"]]},
    {kind:"chapter",id:"1",sectionId:"vocab",sectionTitle:"Vocabulary"},{id:"word",title:"Word"})[0];
  assert.equal(card.japanese,"はい");assert.equal(card.kana,"");assert.equal(card.meaning,"yes");
});


test("pre-made bank: the shared section converter exactly matches every eligible lesson row",()=>{
  const drafts=[];
  for(const [kind,file] of groups)for(const page of load(file)) {
    const examples=collectFlashcardExamples(page.sections,{kind,id:page.ch});
    for(const section of page.sections) {
      const blocks=splitReadingContent(section.html);
      const converted=sectionFlashcards(blocks,{kind,id:page.ch,sectionId:section.id,sectionTitle:section.title},examples);
      assert.deepEqual(converted.map(item=>item.block),blocks);
      drafts.push(...converted.flatMap(item=>(item.flashcards??[]).filter(Boolean)));
    }
  }
  assert.deepEqual(drafts,all.map(item=>item.draft));
});
test("pre-made bank: every page deck validate and fit together without dropping cards",()=>{
  const drafts=[],counts=[];
  for(const [kind,file] of groups.filter(([kind])=>kind!=="practice"))for(const page of load(file)) {
    const pageDrafts=all.filter(item=>item.context.kind===kind&&item.context.id===page.ch).map(item=>item.draft);
    const validated=parseFlashcardDeck({version:1,key:kind+":"+page.ch,drafts:pageDrafts},kind+":"+page.ch);
    assert.deepEqual(validated,pageDrafts);
    const result=addFlashcards(EMPTY_FLASHCARDS,validated,1000);
    assert.equal(result.skipped,0);assert.equal(result.added,new Set(validated.map(flashcardId)).size);
    counts.push(result.added);drafts.push(...validated);
  }
  assert.equal(counts.length,groups.filter(([kind])=>kind!=="practice").reduce((n,[,file])=>n+load(file).length,0));assert.ok(counts.every(count=>count>0));
  const result=addFlashcards(EMPTY_FLASHCARDS,drafts,1000);
  assert.equal(result.skipped,0);assert.equal(result.added,new Set(drafts.map(flashcardId)).size);
  assert.deepEqual(parseFlashcardData(JSON.stringify(result.data)),result.data);
});

test("kana sound charts become reading cards, with both scripts and no invented meaning",()=>{
  const table={headers:["Romaji","Hiragana","Katakana","Hiragana example","Katakana example"],rows:[["ga","が","ガ","がくせい (gakusei), student","ガス (gasu), gas"]]};
  const [draft]=tableFlashcards(table,{kind:"kana",id:"1",sectionId:"lessons",sectionTitle:"Lessons"},{id:"sounds",title:"Sounds"});
  assert.equal(draft.kind,"kana");assert.equal(draft.japanese,"が / ガ");assert.equal(draft.meaning,"ga");assert.equal(draft.romaji,"ga");assert.equal(draft.example,undefined);
});
test("kana word-example meanings stay attached to the whole word, not the kana fragment",()=>{
  const [draft]=tableFlashcards({headers:["Kana","Romaji","Example word","Meaning"],rows:[["っこ","kko","がっこう (gakkou)","school"]]},
    {kind:"kana",id:"1",sectionId:"lessons",sectionTitle:"Lessons"},{id:"double",title:"Double sounds"});
  assert.equal(draft.japanese,"がっこう");assert.equal(draft.romaji,"gakkou");assert.equal(draft.meaning,"school");
});
test("kanji comparison cards keep both characters, readings and the pair's meaning",()=>{
  const [draft]=tableFlashcards({headers:["Pair","Kanji","Readings"],rows:[["up and down","上 / 下","うえ / した"]]},
    {kind:"kanji",id:"1",sectionId:"mixups",sectionTitle:"Common mix-ups"},{id:"pairs",title:"Pairs"});
  assert.equal(draft.kind,"kanji");assert.equal(draft.japanese,"上 / 下");assert.equal(draft.kana,"うえ / した");assert.equal(draft.meaning,"up and down");
});

test("table coverage: every current lesson, vocabulary and comparison table is included",()=>{
  for(const [kind,file] of groups.filter(([kind])=>kind!=="practice"))for(const page of load(file)) {
    for(const section of page.sections.filter(section=>["lessons","vocab","mixups"].includes(section.id))) {
      for(const item of sectionFlashcards(splitReadingContent(section.html),{kind,id:page.ch,sectionId:section.id,sectionTitle:section.title})) {
        if(item.block.type!=="table")continue;
        assert.ok(item.flashcards.some(Boolean),kind+":"+page.ch+" "+JSON.stringify(item.block.table.headers));
      }
    }
  }
});
