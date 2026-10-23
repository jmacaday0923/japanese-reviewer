import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PARTICLE_ROWS, PARTICLE_RULE, VERB_GROUPS, FORM_LABELS } from "../src/lib/cheat-sheets.ts";
const chapters = JSON.parse(readFileSync(new URL("../src/data/chapters.json", import.meta.url), "utf8"));
const html = ch => chapters.find(c => c.ch === ch).sections.map(s => s.html).join("");

test("particles follow sensei's note, in order, with one example each", () => {
  assert.deepEqual(PARTICLE_ROWS.map(r => r.particle), ["は", "が", "を", "に", "で", "に・へ", "(none)", "に", "で", "に", "で", "で", "と"]);
  for (const row of PARTICLE_ROWS) {
    assert.ok(row.example.japanese && row.example.romaji && row.example.english, row.role);
    if (row.particle.length === 1) assert.ok(row.example.japanese.includes(row.particle), row.role);
  }
  assert.match(PARTICLE_RULE, /use と\(and\)$/);
});

test("five verb groups plus Regular and Special, each with real lesson links and taught casual forms", () => {
  assert.deepEqual(VERB_GROUPS.map(g => g.name), ["Group 1", "Group 2", "Group 3", "Group 4", "Group 5", "Regular verbs", "Special verbs"]);
  assert.equal(FORM_LABELS.length, 4);
  const ten = html("10");
  for (const group of VERB_GROUPS) {
    assert.ok(ten.includes('id="' + group.lesson.split("#")[1] + '"'), group.lesson);
    for (const v of group.verbs) {
      assert.ok(ten.includes(v.casual.join("、")), v.verb + " casual forms match Chapter 10");
      const stem = v.formal[0].slice(0, -2);
      assert.deepEqual(v.formal, [stem + "ます", stem + "ません", stem + "ました", stem + "ませんでした"], v.verb);
      assert.equal(v.casual[0], v.verb);
    }
  }
});
