import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectFlashcardExamples, lastFlashcardHeading, tableFlashcards } from "../src/lib/flashcard-content.ts";
import { splitReadingContent } from "../src/lib/reading-content.ts";
import { EMPTY_FLASHCARDS, addFlashcard, parseFlashcardData } from "../src/lib/flashcards.ts";
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
test("flashcard content: all 60 individual kanji, structured vocabulary and sentences are supported",()=>{
  assert.equal(all.filter(item=>item.draft.kind==="kanji").length,60);
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
