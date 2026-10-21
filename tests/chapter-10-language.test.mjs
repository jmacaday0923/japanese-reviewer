import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kanji1Characters, annotateCheckpointText, buildChapter10Presentation } from "../src/lib/chapter-10-checkpoint.ts";
const read = name => JSON.parse(readFileSync(new URL("../src/data/" + name + ".json", import.meta.url), "utf8"));
const bank = read("checkpoint-exams"), policy = read("chapter-10-checkpoint-display");
const known = kanji1Characters(read("kanji")[0]);
const chars = text => [...text.matchAll(/[\p{Script=Han}々]/gu)].map(m => m[0]);
const plain = parts => parts.map(p => p.text).join("");
const scope = (extra = {}) => ({ known: new Set(known), seen: new Set(), protected: new Set(), instructions: false, ...extra });
const contentFields = (q, d) => [
  ...(d.passage ? [[q.passage.text,d.passage]] : []), ...(q.context ? [[q.context,d.context]] : []),
  [q.prompt,d.prompt], ...(q.composition ? [[q.composition.before,d.composition.before],[q.composition.after,d.composition.after]] : []),
  ...q.choices.map(c => [c.text,d.choices[c.id]]), [q.choices.find(c => c.id === q.correctChoiceId).text,d.answer],
  ...(q.completedSentence ? [[q.completedSentence,d.completedSentence]] : []), [q.explanationJa,d.explanationJa], [q.explanationEn,d.explanationEn],
];

test("the familiar list is exactly Kanji 1's 30 primary teaching characters", () => {
  assert.equal(known, "一二三四五六七八九十百千万日月火水木金土円何本人男女子父母友");
  assert.equal(new Set(known).size,30);
  assert.ok(!known.includes("外") && !known.includes("曜"));
  assert.throws(() => kanji1Characters(read("kanji")[1]), /Kanji 1/);
});

test("all seven Chapter 10 parts have English instructions and readings for every heading/instruction kanji", () => {
  for (const e of bank.filter(e => policy.exams[e.id])) {
    const d = buildChapter10Presentation(e,policy,known);
    assert.deepEqual(Object.keys(d.instructionsEn),e.parts.map(p => p.id));
    for (const part of e.parts) for (const [source,parts] of [[part.titleJa,d.prepared.titles[part.id]],[part.instructionsJa,d.prepared.instructions[part.id]]]) {
      assert.equal(plain(parts),source);
      for (const piece of parts) if (chars(piece.text).length) assert.match(piece.reading,/^[ぁ-ゖー]+$/u);
    }
  }
});

test("every field in all 80 items retains its text and only first unfamiliar, unprotected characters receive furigana", () => {
  const original=structuredClone(bank);
  for (const e of bank.filter(e => policy.exams[e.id])) {
    const d=buildChapter10Presentation(e,policy,known);
    assert.equal(Object.keys(d.prepared.questions).length,40);
    for (const p of e.parts) for (const q of p.questions) {
      const seen=new Set(), protectedCharacters=new Set(chars(q.target??""));
      if (policy.exams[e.id].protectChoiceReadings.includes(p.id))
        for (const c of q.choices) for (const character of chars(c.text)) protectedCharacters.add(character);
      for (const [source,parts] of contentFields(q,d.prepared.questions[q.id])) {
        assert.equal(plain(parts),source,q.id);
        for (const piece of parts) {
          const characters=chars(piece.text);
          const required=characters.filter(c => !known.includes(c) && !protectedCharacters.has(c) && !seen.has(c));
          assert.equal(Boolean(piece.reading),required.length>0,q.id+": "+piece.text);
          if (piece.reading) { assert.equal(characters.length,1); assert.match(piece.reading,/^[ぁ-ゖー]+$/u); }
          for (const character of characters) seen.add(character);
        }
      }
    }
  }
  assert.deepEqual(bank,original);
});

test("first-use tracking crosses fields in one item, resets for another and instructions always show readings", () => {
  const item=scope();
  assert.deepEqual(annotateCheckpointText("入る。入る。",policy,item),[{text:"入",reading:"はい"},{text:"る"},{text:"。"},{text:"入"},{text:"る"},{text:"。"}]);
  assert.ok(annotateCheckpointText("入る",policy,item).every(p=>!p.reading));
  assert.ok(annotateCheckpointText("入る",policy,scope()).some(p=>p.reading));
  const directions=scope({instructions:true});
  assert.equal(annotateCheckpointText("一つ。一つ。",policy,directions).filter(p=>p.reading).length,2);
  assert.deepEqual(annotateCheckpointText("日本の本",policy,scope()),[{text:"日本の本"}]);
  const e=structuredClone(bank.find(e=>e.id==="grammar"));
  e.parts=[e.parts.find(p=>p.id==="text")];
  e.parts[0].questions=e.parts[0].questions.slice(0,2).map(q=>({...q,prompt:"入る",passage:{id:"shared",text:"入る。入る。"}}));
  const prepared=buildChapter10Presentation(e,policy,known).prepared.questions;
  const [first,second]=e.parts[0].questions.map(q=>prepared[q.id]);
  assert.equal(first.passage.filter(p=>p.reading).length,1);
  assert.ok(first.prompt.every(p=>!p.reading));
  assert.equal(second.passage,undefined);
  assert.equal(second.prompt.filter(p=>p.reading).length,1);
});

test("a tested character stays bare in reading/meaning items, including feedback and differently inflected occurrences", () => {
  const item=scope({protected:new Set(["入"])});
  assert.ok(annotateCheckpointText("入る。入れます",policy,item).every(p=>!p.reading));
  assert.throws(()=>annotateCheckpointText("入未知",policy,item),/Missing Chapter 10/);
  const e=structuredClone(bank[0]);e.parts=[structuredClone(e.parts[0])];e.parts[0].questions=[{
    ...e.parts[0].questions[0],target:"入る",prompt:"入る の いみは どれですか。",explanationJa:"入る。",explanationEn:"入る means enter.",
  }];
  const d=buildChapter10Presentation(e,policy,known).prepared.questions[e.parts[0].questions[0].id];
  assert.ok([...d.prompt,...d.explanationJa,...d.explanationEn].every(p=>!p.reading));
});

test("all four written-form items suppress readings on every choice to avoid revealing the key", () => {
  const e=bank.find(e=>e.id==="vocabulary"),d=buildChapter10Presentation(e,policy,known);
  for (const q of e.parts.find(p=>p.id==="spelling").questions) {
    const item=d.prepared.questions[q.id];
    assert.ok(Object.values(item.choices).flat().every(p=>!p.reading));
    assert.ok([...item.answer,...item.explanationJa,...item.explanationEn].every(p=>!p.reading));
  }
});

test("partial compounds annotate only new unfamiliar characters, and new kanji require a reviewed reading", () => {
  const sample={...policy,lexicon:{...policy.lexicon,"日本語":[{text:"日",reading:"に"},{text:"本",reading:"ほん"},{text:"語",reading:"ご"}]}};
  assert.deepEqual(annotateCheckpointText("日本語",sample,scope()),[{text:"日"},{text:"本"},{text:"語",reading:"ご"}]);
  assert.throws(()=>annotateCheckpointText("京都",policy,scope()),/Missing Chapter 10/);
  assert.throws(()=>buildChapter10Presentation(bank.find(e=>e.id==="chapter-5"),policy,known),/No Chapter 10/);
});
