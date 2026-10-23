// Quick-reference data for the cheat sheet page. The particle notes are the
// sensei's own words; the verb forms come from the Chapter 7, 9 and 10 lessons.
export type ParticleRow = {
  role: string; particle: string; note: string;
  example: { japanese: string; romaji: string; english: string };
};

export const PARTICLE_ROWS: ParticleRow[] = [
  { role: "Main topic", particle: "は", note: "",
    example: { japanese: "わたしは がくせいです。", romaji: "watashi wa gakusei desu.", english: "I am a student." } },
  { role: "Sub-topic", particle: "が", note: "descriptive",
    example: { japanese: "ぞうは はなが ながいです。", romaji: "zou wa hana ga nagai desu.", english: "Elephants have long noses." } },
  { role: "Direct object", particle: "を", note: "effective/affective actions",
    example: { japanese: "コーヒーを のみます。", romaji: "ko-hi- o nomimasu.", english: "I drink coffee." } },
  { role: "Location (where is something)", particle: "に", note: "non-action/passive",
    example: { japanese: "へやに ねこが います。", romaji: "heya ni neko ga imasu.", english: "There is a cat in the room." } },
  { role: "Place of action", particle: "で", note: "transitive/effective/affective",
    example: { japanese: "としょかんで べんきょうします。", romaji: "toshokan de benkyoushimasu.", english: "I study at the library." } },
  { role: "Destination・direction", particle: "に・へ", note: "",
    example: { japanese: "にほんに いきます。", romaji: "nihon ni ikimasu.", english: "I go to Japan." } },
  { role: "Non-specific time expression", particle: "(none)", note: "",
    example: { japanese: "あした いきます。", romaji: "ashita ikimasu.", english: "I will go tomorrow." } },
  { role: "Specific time", particle: "に", note: "",
    example: { japanese: "しちじに おきます。", romaji: "shichiji ni okimasu.", english: "I get up at seven." } },
  { role: "Duration", particle: "で", note: "happens within said duration",
    example: { japanese: "いっしゅうかんで よみました。", romaji: "isshuukan de yomimashita.", english: "I read it in one week." } },
  { role: "Recipient of action", particle: "に", note: "for who is the action for",
    example: { japanese: "ともだちに でんわします。", romaji: "tomodachi ni denwashimasu.", english: "I call my friend." } },
  { role: "Tool of action", particle: "で", note: "how are you going to do something",
    example: { japanese: "はしで たべます。", romaji: "hashi de tabemasu.", english: "I eat with chopsticks." } },
  { role: "Number of people: companion", particle: "で", note: "unit should be for number of people",
    example: { japanese: "ふたりで いきます。", romaji: "futari de ikimasu.", english: "The two of us will go." } },
  { role: "Companion", particle: "と", note: "who are you doing the action with",
    example: { japanese: "かぞくと たべます。", romaji: "kazoku to tabemasu.", english: "I eat with my family." } },
];

export const PARTICLE_RULE = "If the marker has a different purpose, then you're allowed to repeat it, if not; then use と(and)";

// The sensei's sentence: numbered phrases work like a list and can change places.
export const SENTENCE_EXAMPLE = {
  english: "Mari and her husband will work hard in another country for their family for a year from next month.",
  phrases: [
    { mark: "¹", japanese: "「らいげつ」　から", role: "time it starts" },
    { mark: "²", japanese: "「マリーさん　と　おっと」　は", role: "main topic" },
    { mark: "³", japanese: "「がいこく」　で", role: "place of action" },
    { mark: "⁴", japanese: "「かぞく」　に", role: "recipient of action" },
  ],
  ending: "いちねんかん　「まじめに　しごとします」",
};

export type VerbForms = {
  verb: string; romaji: string; english: string;
  formal: [string, string, string, string]; // present, present negative, past, past negative
  casual: [string, string, string, string]; // dictionary, nai, ta, nakatta
};
export type VerbGroup = {
  id: string; name: string; endings: string; lesson: string; rules: string[]; verbs: VerbForms[]; watch?: string;
};

export const FORM_LABELS = ["Present", "Present negative", "Past", "Past negative"] as const;

export const VERB_GROUPS: VerbGroup[] = [
  { id: "group-1", name: "Group 1", endings: "ぶ, む, ぬ", lesson: "/chapters/10#c10-10-3-group-1-verbs-that-end-in-bu-mu-or-",
    rules: ["ない: change the last sound to ば, ま or な, then add ない.", "た: ぶ, む and ぬ all become んだ."],
    verbs: [
      { verb: "のむ", romaji: "nomu", english: "drink", formal: ["のみます", "のみません", "のみました", "のみませんでした"], casual: ["のむ", "のまない", "のんだ", "のまなかった"] },
      { verb: "あそぶ", romaji: "asobu", english: "play", formal: ["あそびます", "あそびません", "あそびました", "あそびませんでした"], casual: ["あそぶ", "あそばない", "あそんだ", "あそばなかった"] },
    ],
    watch: "よんだ can come from よむ (read) or よぶ (call). Context decides." },
  { id: "group-2", name: "Group 2", endings: "ぐ", lesson: "/chapters/10#c10-10-4-group-2-verbs-that-end-in-gu-page-1",
    rules: ["ない: ぐ becomes が, then add ない.", "た: ぐ becomes いだ."],
    verbs: [
      { verb: "およぐ", romaji: "oyogu", english: "swim", formal: ["およぎます", "およぎません", "およぎました", "およぎませんでした"], casual: ["およぐ", "およがない", "およいだ", "およがなかった"] },
    ] },
  { id: "group-3", name: "Group 3", endings: "す", lesson: "/chapters/10#c10-10-5-group-3-verbs-that-end-in-su-page-1",
    rules: ["ない: す becomes さ, then add ない.", "た: す becomes した."],
    verbs: [
      { verb: "はなす", romaji: "hanasu", english: "speak", formal: ["はなします", "はなしません", "はなしました", "はなしませんでした"], casual: ["はなす", "はなさない", "はなした", "はなさなかった"] },
    ] },
  { id: "group-4", name: "Group 4", endings: "く", lesson: "/chapters/10#c10-10-6-group-4-verbs-that-end-in-ku-page-1",
    rules: ["ない: く becomes か, then add ない.", "た: く becomes いた."],
    verbs: [
      { verb: "かく", romaji: "kaku", english: "write", formal: ["かきます", "かきません", "かきました", "かきませんでした"], casual: ["かく", "かかない", "かいた", "かかなかった"] },
    ],
    watch: "いく (go) ends in く but sits in Group 5, because its た form is いった." },
  { id: "group-5", name: "Group 5", endings: "う, つ, る", lesson: "/chapters/10#c10-10-7-group-5-verbs-that-end-in-u-tsu-or-",
    rules: ["ない: う becomes わ, つ becomes た, る becomes ら, then add ない.", "た: う, つ and る all become った."],
    verbs: [
      { verb: "かう", romaji: "kau", english: "buy", formal: ["かいます", "かいません", "かいました", "かいませんでした"], casual: ["かう", "かわない", "かった", "かわなかった"] },
      { verb: "まつ", romaji: "matsu", english: "wait", formal: ["まちます", "まちません", "まちました", "まちませんでした"], casual: ["まつ", "またない", "まった", "またなかった"] },
      { verb: "わかる", romaji: "wakaru", english: "understand", formal: ["わかります", "わかりません", "わかりました", "わかりませんでした"], casual: ["わかる", "わからない", "わかった", "わからなかった"] },
      { verb: "いく", romaji: "iku", english: "go", formal: ["いきます", "いきません", "いきました", "いきませんでした"], casual: ["いく", "いかない", "いった", "いかなかった"] },
      { verb: "かえる", romaji: "kaeru", english: "go home", formal: ["かえります", "かえりません", "かえりました", "かえりませんでした"], casual: ["かえる", "かえらない", "かえった", "かえらなかった"] },
    ],
    watch: "かえる, しる, はいる, はしる and きる (cut) end in える or いる but belong here, not to the Regular verbs." },
  { id: "regular", name: "Regular verbs", endings: "える, いる", lesson: "/chapters/10#c10-10-8-regular-verbs-eru-and-iru-page-149",
    rules: ["Drop る, then add ない, た or なかった. The last sound never changes."],
    verbs: [
      { verb: "たべる", romaji: "taberu", english: "eat", formal: ["たべます", "たべません", "たべました", "たべませんでした"], casual: ["たべる", "たべない", "たべた", "たべなかった"] },
      { verb: "みる", romaji: "miru", english: "watch", formal: ["みます", "みません", "みました", "みませんでした"], casual: ["みる", "みない", "みた", "みなかった"] },
    ] },
  { id: "special", name: "Special verbs", endings: "する, くる", lesson: "/chapters/10#c10-10-9-special-verbs-suru-and-kuru-page-14",
    rules: ["Memorize these two. Every noun + する verb, such as べんきょうする, follows する."],
    verbs: [
      { verb: "する", romaji: "suru", english: "do", formal: ["します", "しません", "しました", "しませんでした"], casual: ["する", "しない", "した", "しなかった"] },
      { verb: "くる", romaji: "kuru", english: "come", formal: ["きます", "きません", "きました", "きませんでした"], casual: ["くる", "こない", "きた", "こなかった"] },
    ],
    watch: "くる starts with こ in こない and こなかった, but with き in きます and きた." },
];
