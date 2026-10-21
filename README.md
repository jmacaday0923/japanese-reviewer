# Japanese Lesson Reviewer

A personal study site for Japanese lessons. Search vocabulary, grammar, kana and kanji across the study pages, review Chapters 1–11, practise with flashcards and exercises, and assess progress with checkpoints and listening exams.

Built with Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript and Tailwind CSS 4. Deployed on Vercel.

## Setup

You need **Node.js 22.6 or newer**. The Node tests load TypeScript files directly with `--experimental-strip-types`, which needs 22.6 or later. Node 24 is what this project is developed on. Check your version with `node -v`.

```bash
npm install
```

## Run it

| What | Command | Where |
| --- | --- | --- |
| Development | `npm run dev` | http://localhost:3000 |
| Production build | `npm run build` | |
| Production server | `npm start` (after a build) | http://localhost:3000 |

If styles look stale in development, stop the server, delete `.next`, and start again.

## Tests

**Node tests** check the search and outline helpers against the real data: matching, URL reading and writing, the search payload, outline grouping, and anchors.

```bash
npm test
```

**Type check.** A fresh checkout has no `.next` folder or `next-env.d.ts` (git ignores both), so this script generates the Next.js route types first, then runs TypeScript:

```bash
npm run typecheck   # next typegen && tsc --noEmit --incremental false
```

**Browser tests** (Playwright, Chromium) check what you see and do: search, readers, layout at several widths, keyboard use, and the smoke checks below. They run against the production build:

```bash
npx playwright install chromium   # once, downloads the browser
npm run build                     # once per code change
npm run test:e2e                  # starts its own server on port 3100, stops it afterwards
```

- Set `E2E_PORT` to use another port. If a server is already running on that port, the tests reuse it.
- Open the last HTML report with `npx playwright show-report`.
- Reports and traces go to `playwright-report/` and `test-results/`, which git ignores.

Before committing, run all checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

### Smoke tests against a deployed site

`e2e/smoke.spec.ts` is a short check that a live site works: the home page and search, one chapter, Kana, Kanji and a legacy document link, a section anchor opened directly, and no page errors, console errors or failed requests. It doesn't compare counts with your local data, so it passes even when the deployed data differs from your checkout.

Set `E2E_BASE_URL` to the site's address. Playwright then tests that site and starts no local server, so you don't need a build:

```bash
npx playwright install chromium   # once
E2E_BASE_URL=https://japanese-reviewer.vercel.app npm run test:smoke
```

- Use the same command with a Vercel preview URL to check a branch before merging. Previews that ask you to log in (Vercel Authentication) can't be tested this way.
- `npm run test:smoke` without `E2E_BASE_URL` runs the same checks against your local build on port 3100.
- `E2E_BASE_URL=... npm run test:e2e` runs the full suite against the site, but its exact counts expect the deployed data to match your checkout.

### GitHub Actions

`.github/workflows/ci.yml` runs on every push to `main`, on every pull request, and by hand from the Actions tab (Run workflow). It uses Node.js 24 and runs, in order: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`. When a step fails, the Playwright report and traces are attached to the run as the `playwright-report` artifact for 14 days. Download it, unzip it, and open it with `npx playwright show-report playwright-report`, or drop a `trace.zip` from `test-results/` onto https://trace.playwright.dev.

## Search URLs

The search lives in the URL of the home page, so a search can be bookmarked or shared.

| Parameter | Values | Default (left out of the URL) |
| --- | --- | --- |
| `q` | Any text, matched case-insensitively against kana, romaji and English | empty |
| `category` | `vocab`, `grammar`, `script` (Kana & Kanji), `practice`, `answers` | all |
| `chapter` | `1` to `11`, `kana`, `kanji`, `practice` (derived from the current study pages) | all |

- Example: `/?q=gakkou&category=vocab&chapter=1`
- Unknown values fall back to the default. Other parameters and the `#hash` are kept.
- Typing replaces the current history entry. Filters, Clear and Reset add one, so Back undoes them.
- On the home page, Ctrl+K (⌘K on a Mac) puts the cursor in the search box.

## Study organization

Documents are consolidated into Chapters, Kana and Kanji. Search results use content categories such as Grammar, Vocabulary, Kana & Kanji, Practice and Answers. Old `/lessons` addresses resolve through the preserved migration map; there is no separate Documents reader or `lesson-data.json`.

## Interactive exercises

Chapters 1 and 2 retain a quick **Interactive practice** panel at the top of their Exercises section: **Particles** (fill in the marker) and **Vocabulary** (match each Japanese word to its meaning). The source exercise activities and answer keys stay below it; older chapter tables now also have inline answer controls. Answers are checked in the browser and not saved: reloading starts fresh, and the bookmark storage isn't touched.

The questions live in `src/data/exercises.json`, copied from `chapters.json` word for word (the Question, Answer and Why cells), with each question's source part, answer key part and number. `tests/exercises.test.mjs` checks every question against the original tables.

To add another chapter: add an entry to `src/data/exercises.json` like the existing ones (set ids `c<chapter>-particles` and `c<chapter>-vocabulary`, question ids `<set id>-<number>`), fill in `accepted` deliberately (romaji and kana, plus any alternative the answer key itself allows), then extend the expected chapter list in the first test. Run `npm test`: it fails on any word that doesn't match the source.

## Sentence building

Every chapter has a **Sentence building** panel in its Exercises section, below existing interactive practice where present. Arrange word and phrase tiles to reconstruct three lesson examples per chapter (33 puzzles across the current 11 chapters). Select a chosen tile to remove it, use **Undo last tile** or **Clear sentence**, then **Check answer**. Tiles work with touch, mouse and keyboard; dragging is not required. This activity checks the source sentence's order; other natural Japanese orders may be possible.

Chapters 1, 6 and 10 also offer **Transformations**: 12 curated positive-to-negative and polite-to-casual questions. Type kana or romaji from the lesson. Grading ignores whitespace, case, character width and final full stops; it preserves particles, long vowels, meaning and tense. Only source-printed alternatives, optional particles and the documented negative copulas are accepted. There is no automatic conjugator or open-ended grammar checker.

Model answers, readings, meanings, explanations and source links appear after checking. Answer romaji and English follow reading-aid preferences with individual reveal controls. Essential task cues stay visible. **Retry incorrect** keeps correct answers and the first score; **Restart practice** clears the current activity. Switching activities keeps progress; a full reload starts fresh. No practice answers are stored or sent to a server.

`src/data/sentence-exercises.json` holds the starter bank, with exact heading/table/row references to `chapters.json`. Only the current chapter's questions cross the server/client boundary. `tests/sentence-exercises.test.mjs` verifies every sentence, reading, translation and explanation against its source, plus grading and retries. `e2e/sentence-exercises.spec.ts` covers browser interactions and narrow screens. To extend the bank, use a verified original/target example pair for each transformation and add deliberate accepted alternatives through the grading helper; run all checks before publishing.

## Reading comprehension and workbook romaji

The 12 reading-comprehension passages in Chapters 5–10 start with Japanese text and Japanese questions/choices. **Romaji support (optional)** and **English translation (optional)** are separate, closed disclosures for each passage. Open either when needed; they start closed on a full reload and work without JavaScript. These local reading supports are independent of the global aids used by lesson tables. Search still includes their content and always shows matching readings and meanings.

Vocabulary notes sit below a passage only when an expression has not been taught in that chapter's or an earlier chapter's Lessons/Vocabulary sections. Repeated “Words” lists are removed. The current audit finds one untaught expression: **これから**, in Chapter 9's second book-reading question. It is explained below that passage. Other words, including the Chapter 8 cafeteria vocabulary and Chapter 10 cherry-blossom phrase, already appear in the study material.

The content remains in `src/data/chapters.json`; `migration/reading-exercise-audit.json` records the 12 passages, 58 question revisions, original content, translations and 247 references to taught vocabulary. This is a manual content review, not an automatic Japanese tokenizer. Native disclosure styles live in `src/app/globals.css`. `tests/reading-exercises.test.mjs` checks scope, Japanese prompts, source references and search; `e2e/reading-exercises.spec.ts` checks default visibility, independent reveals, keyboard use, notes and narrow screens.

### Workbook exercises in every chapter

Workbook prompts in Chapters 1–10 now show Japanese first. Each activity has one closed **Romaji support (optional)** panel containing its question readings, passage transcription and original example wording. Instructions and English-to-Japanese translation prompts stay available. The existing global lesson-table reading aids do not automatically open workbook support.

This covers 78 workbook activities in addition to the six previously updated book-reading panels. There are 68 new support panels, 510 Japanese question/choice prompts, and 16 passage paragraphs with optional transcriptions. Chapters 1–3 receive Japanese versions for their previously romaji-only material; later chapters reuse their existing printed Japanese. Cloze blanks, numbered choices, adjective word banks and English picture descriptions are retained. The previously added Chapter 5–10 reading translations and vocabulary notes keep their existing controls.

The content is stored in `src/data/chapters.json`, with review history in `migration/workbook-romaji-audit.json`. No runtime transliteration is used. A fresh load starts support closed; opening it affects that activity, and reloading closes it. `tests/workbook-romaji.test.mjs` and `e2e/workbook-romaji.spec.ts` cover source preservation, search, all ten chapters, independent reveals and phone layout.

## Bookmarks and Continue studying

Reader pages have a **Bookmark page** button, and a **Bookmark section** button after you jump to a section from On this page. The dashboard shows your bookmarks and the last study page you opened.

- Saved only in this browser, in localStorage under `japanese-reviewer:study`, as JSON with a `version` number (currently 1). Nothing is sent to a server, so bookmarks don't follow you to another browser or device.
- Saved data that can't be read is ignored and replaced on the next change. Bookmarks to pages that no longer exist are hidden, and a bookmark whose section is gone opens its page instead.
- If the browser blocks storage (some private modes, or site data turned off), even after the page has loaded, bookmarks still work until you close the tab, and the page says so.
- To clear everything: in DevTools, Application, Local Storage, delete `japanese-reviewer:study`.

## Project layout

| Path | What it is |
| --- | --- |
| `src/data/` | Study pages, Japanese/English display catalogs, exercise banks, chapter study guides, checkpoint/listening exams and legacy links |
| `src/app/` | Dashboard, chapter/Kana/Kanji readers, flashcards, checkpoints, listening, search/deck endpoints and compatibility routes |
| `src/components/` | Shell, dashboard cards, search, the shared reader (ReaderLayout, TableOfContents, LessonContent), and the bookmark parts (BookmarkControls, StudyShelf, use-study) |
| `src/lib/` | Search helpers, the server-only search payload, outline builders, bookmark storage (`study.ts`), exercise grading (`exercises.ts`), source table adaptation (`legacy-exercises.ts`) and server-only exercise banks |
| `tests/` | Node tests (`*.test.mjs`) |
| `e2e/` | Browser tests (`*.spec.ts`), including the hosted smoke tests (`smoke.spec.ts`) |
| `.github/workflows/` | The CI workflow (`ci.yml`) |

## Manual checklist

Automated tests use Chromium and synthetic input. Check these by hand before a release:

- [ ] Japanese input with the real macOS keyboard (Hiragana): type がっこう. Results and the URL update only after you commit with Return.
- [ ] Safari and Firefox: search, filters, Back and Forward, the reader outline.
- [ ] A real phone: the menu, the "On this page" box, wide tables scrolling sideways inside their frame.
- [ ] Search `gakkou`, open a result, check it lands on the right heading, then press Back.
- [ ] `/kana/1` at full width: the outline stays beside the text while scrolling.
- [ ] `/chapters/99` shows "Page not found".
- [ ] Bookmark a page and a section, close the browser, open it again: both are on the dashboard.
- [ ] Safari private window: bookmarks still work while the tab is open.


## Flashcards

Use **Add to flashcards** beside a structured vocabulary row, an individual kanji entry, or a Japanese lesson sentence. Open **Flashcards** from the Saved navigation group.

- Japanese → meaning and English → Japanese have independent schedules and performance counts.
- Reveal the answer before self-rating Again, Hard, Good or Easy. The question and essential Japanese answer remain visible; secondary answer readings and meanings use the existing reading-aid preferences. Source examples appear only when a verified bilingual sentence is available.
- Choose one or several chapters/study pages, or all saved cards. Identical cards saved from different pages merge their source links without resetting progress.
- The default is 20 new cards per local day per direction, configurable from 0 to 200. The allowance spans all chapter filters. It is consumed by the first rating of a new card; scheduled reviews do not consume it.
- Again returns in 10 minutes. Hard during learning returns in 30 minutes. Initial Good is 1 calendar day and Easy is 4. Established Hard/Good/Easy intervals grow by 1.2/2.5/3.2, rounded up and capped at 3,650 days. Day-based cards are due at local midnight; this is a simple deterministic scheduler, not FSRS.
- Cards, settings and progress are local to this browser under **japanese-reviewer:flashcards** (version 1). They do not sync between devices, and clearing site data removes the deck. Storage failures retain an in-memory deck while the page stays open; a full reload or closing the tab discards unsaved changes. The deck limit is 5,000 cards.
- Manage saved cards supports removal and undo. Removing a card removes its schedules; undo restores them. Today's introduction allowance is retained.

**src/lib/flashcard-content.ts** extracts source-backed cards on the server; **src/lib/flashcards.ts** contains pure scheduling, queue and storage helpers. No dependency or lesson-data changes are needed. **tests/flashcards.test.mjs**, **tests/flashcard-content.test.mjs** and **e2e/flashcards.spec.ts** cover the feature.

### Pre-made decks and bulk saving

Each eligible lesson table has **Add all N to flashcards** in its header. It saves all supported rows in one transaction, merges duplicates and retains both review histories. Kana sound charts save their paired hiragana/katakana and romaji reading. Kana word-example tables save the whole word with its meaning, rather than giving a sound fragment the word’s translation. Kanji comparisons retain their paired characters and readings. Exercise answer sheets and unpaired content are not converted.

On **Flashcards**, choose one or more **Pre-made decks**, then **Add selected decks and review**. There are 14 decks: 11 chapters, Kana 1 and Kanji 1–2. Deck metadata follows the current library. The bank is derived from the same source-backed rows as the lesson buttons; each selected deck loads from **/flashcard-decks/[deck]** on demand. Only deck names/counts are included in the initial flashcards page, not the whole bank.

The shared content bank ships with the app. Your saved cards and per-direction schedules use the existing browser storage; there is no database or account setup. Importing again adds newly available content without resetting existing progress. Removed cards return if you deliberately import their deck again. Clearing browser site data removes saved cards/progress; the app still provides the pre-made bank.

Reviews use a seeded shuffle that stays stable while revealing answers or changing display toggles. Due cards come first; new cards are sampled from the entire selected pool before applying the daily limit. **Shuffle review order** starts a new random order without resetting schedules or the daily allowance. Again can repeat a card after its scheduled ten-minute wait. No immediate repeats occur after rating a card. Use the saved-page filters below the pre-made picker to switch between already imported chapters.

## Japanese-first study content

Romaji starts hidden on every chapter, Kana, Kanji and practice page. Use **Show romaji** in Reading aids to show it across study content, or **Reveal Romaji** beside a particular item. **Hide revealed hints** closes temporary reveals. Existing reading and workbook support panels keep their own closed-by-default disclosures. English and kana-reading preferences remain independent; no ruby text is added above kanji.

Exercises, explanations, answer keys, grammar headings and the interactive activities use reviewed Japanese display text from **src/data/japanese-display.json**. The source datasets and answer banks remain the reference for search, flashcard IDs and grading. Search continues to show all readings and meanings. Kana writing drills use English meaning cues, and look-alike drills use the opposite script, so the prompt does not print the answer.

Reading preferences now use version 2 of the same browser-storage key. Version 1 migrates to romaji hidden while preserving English and kana choices; an explicit Show romaji choice in version 2 persists. Flashcards, bookmarks and exercise grading are unaffected. Reverse Kana flashcards keep their original task but require revealing the romaji prompt when romaji is hidden.

When editing course content, add or review its exact Japanese display string before regenerating the audit:

```sh
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/audit-japanese-display.mjs
npm test
```

The audit records every study page and source-file fingerprints. It prevents a source-content edit from silently bypassing the display review. The display layer uses exact strings; it does not transliterate or guess Japanese at runtime.


## Listening exams

`/listening` lists the listening practice sets. `/listening/jlpt-n5-2025-07` contains 24 questions in four parts, using the supplied section recordings. Listening is also available from the desktop sidebar, mobile menu and home dashboard.

- One audio player is active at a time; audio starts on a user action and supports native pause and seeking.
- Answers, selected part, submitted result and first-attempt score are saved in this browser, under a separate versioned key per exam. Audio positions are remembered while switching parts in the open exam; they reset after a page reload.
- Submit the complete exam to see generated answers, Japanese explanations, optional English support and replayable audio clues. Incomplete submissions require confirmation.
- Retry incorrect keeps correct answers and the first score. Restart requires confirmation and starts a new attempt.
- The answer key was generated from the supplied recordings and question images. It is a practice key, not an official JLPT key or scaled score. Source and artwork details are recorded in `migration/listening-audit.json`.

Exam content lives in `src/data/listening-exams.json`; audio and illustrations are local files under `public/audio/listening` and `public/images/listening`. Add another exam object with a unique ID, stable question/choice IDs, matching assets and an answer key. Increment its revision if existing questions or answers change incompatibly, so saved attempts do not silently refer to different content. No runtime speech service or image-generation dependency is required.

After `npm run build`, run the focused browser checks with:

```bash
CI=1 E2E_BASE_URL= E2E_PORT=3132 npx playwright test e2e/listening.spec.ts --workers=4 --retries=0 --reporter=list
```


## Vocabulary and grammar checkpoints

After Chapter 10, open `/checkpoints` for one vocabulary exam and one grammar exam.
Each contains 40 original four-choice questions: 28 focus on Chapters 6–10 and
12 cover Chapters 1–5. The home page, sidebar, phone menu and Chapter 10 link to them.

- Vocabulary: kanji readings, written forms, words in context and similar meanings.
- Grammar: form choices, starred sentence composition and short text grammar.
- Questions and choices use Japanese without romaji or answer-revealing translation hints.
- Submit for raw marks, first-submission chapter/type breakdowns, explanations and lesson links.
- Retry mistakes while retaining correct answers and the original assessment.
- Start a fresh attempt to record a new first-submission score; the latest ten stay in browser history.
- These are fixed course practice forms inspired by JLPT formats, not official papers or scaled JLPT scores.

The curated bank is `src/data/checkpoint-exams.json`. Every question includes its
source chapter/heading, four distinct choices, a key, and Japanese/English rationale.
`migration/checkpoint-audit.json` records coverage, keys and source checksums.
When changing an exam's questions or key, increment that exam's `revision` so old
browser attempts are not scored against new content. Attempts are per browser and
exam; no server account or new service is required. Avoid adding the keyed question
bank to search results, which would expose the answers while taking an exam.


## Chapter 5 checkpoint

The former **N5 Practice Exam, Chapters 1 to 5** is now one interactive checkpoint at `/checkpoints/chapter-5`: all 40 vocabulary questions, 14 reading questions and three passages are preserved. Reading questions are numbered 41–54 in the combined exam. Questions and choices use Japanese, including translated context clues; no romaji or English hint appears before submission. The original English passage translations are available after submission and follow the English reading preference.

Each question is worth one raw mark. Both parts contribute to the score out of 54; submission asks for confirmation if anything is blank. Saved answers, the active part, first submission, retries and the latest ten full-attempt results use `japanese-reviewer:checkpoint:chapter-5:v1`. Retrying retains correct answers and the original score. There is no time limit or official pass prediction.

The dashboard and navigation group all three exams under **Checkpoints**, with a link after Chapter 5. The Chapter 10 exams keep their question IDs, revisions and storage keys. `/practice/1` is a compatibility address for the same Chapter 5 exam, with the same answers and history. Old exercise, answer and passage fragments select their corresponding questions; an old answer-key link never submits an exam or exposes a key. Existing search and bookmark records remain usable. The unchanged `practice.json` remains the source archive for provenance, search and bookmark resolution, so old search snippets can still contain source answer explanations.

`migration/chapter-5-checkpoint-audit.json` maps every question and key back to that archive, including original reading numbers and native display text. `tests/chapter-5-checkpoint.test.mjs` verifies all 54 mappings and the three passages; `e2e/chapter-5-checkpoint.spec.ts` covers completion, persistence, retries, legacy fragments and narrow screens.


## Chapter 11

`/chapters/11` adds **Set Phrases, Changes and Potential Forms**, adapted from the supplied scanned Chapter11.pdf (printed pages 7–22): 42 vocabulary entries, 86 bilingual lesson examples, the 14-row potential-form chart, two reading passages and all 90 workbook questions.

The chapter uses the existing lesson/vocabulary/mix-up/exercise/model-answer layout, search index, bookmarks, flashcard buttons and pre-made decks. Three additional lesson-based sentence puzzles follow the existing sentence bank. Japanese leads and romaji starts hidden. Reading romaji and English are in independent closed disclosures. New reading-vocabulary notes follow each passage; previously taught 本社 and 支店 are not repeated as new words.

`src/data/workbook-exercises.json` stores 12 source-labelled activities. `StudyHtml` replaces each `data-workbook-set` reference block with the reusable `WorkbookExercises` component. Of the 90 questions, 68 use explicit checked answers (including word tiles); 22 open cloze, personal and translation questions use model comparison and self-check. All inputs are interactive. Correct answers stay locked during retries and the first score is preserved for checked activities. Self-check results are labelled separately. Like existing chapter practice, progress lasts in the open page; a full reload starts fresh.

All 12 activities show a smaller English instruction directly below the Japanese instruction. These task directions stay visible even when English reading aids are hidden. The translations are stored in each activity's optional `instructionsEn` field.

No answer key was supplied. All keys and explanations are **added model answers**, not official textbook answers. Typed exercises request kana and accept reviewed printed variants; this is not an unrestricted Japanese sentence evaluator. Text-grammar question 3 accepts both が and を with 書けます. Other transformation drills explicitly request the textbook's が pattern. The potential chart uses 五段／一段／special labels to clarify the PDF's terminology.

`migration/chapter-11-audit.json` records source checksums, printed-page coverage, keys, adaptations, reading notes and hashes proving Chapters 1–10 are unchanged. Existing Chapter 5/10 checkpoints keep their scope, revisions and storage keys. Future chapters can append workbook sets and source reference markup without changing the grading component.

## Older chapter practice and study plans

Every chapter has three learning goals and links through its study sections. Chapter 10 explains how the older book's numbered verb groups relate to 五段, 一段 and irregular verbs. The goals live in `src/data/chapter-guides.json`.

Chapters 1–10 have **291 interactive source tables covering all 3,166 existing questions**. Select **Answer** below a question to open its input. Japanese directions precede English directions; essential directions stay visible with English hints hidden. The Japanese prompt has the full row width, with controls below it on desktop and phone.

- 168 numbered-choice questions and 84 particle questions use explicit source keys.
- 436 fixed-form questions check the printed kana form; the source's printed romaji is also accepted. The directions state this constrained task.
- 2,478 open responses use model comparison and self-check. Translation, multiple-form conjugation and other valid Japanese expressions are not graded by string equality.
- Check an answer or reveal a model after writing. Explanations follow English reading-aid preferences; romaji keeps its own reveal controls. **Retry incorrect** or **Retry needs review** keeps completed answers. Self-check counts are labelled separately from automatic scores.
- Closing a row keeps its answer while the page is open. A reload starts fresh. No exercise answers are saved to localStorage or sent to a server.

`buildLegacyActivities` pairs each existing question table with its source answer table on the server. The chapter datasets and anchors remain unchanged, preserving search, bookmarks, lesson examples, flashcard identifiers and the existing migration audits. Only the current page's prepared content reaches the browser; the full display catalogs remain server-side. Chapter 11 retains its curated workbook bank and existing interactions. Kana/Kanji exercise tables and assessment banks keep their current behavior.

`migration/older-chapter-audit.json` records all 291 mappings, question fingerprints, accepted finite answers and source hashes. After reviewing a source or grading-policy change, regenerate it with:

```bash
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/audit-older-chapters.mjs
```

`tests/legacy-exercises.test.mjs` verifies source coverage, conservative grading and actual reader bindings; `e2e/older-chapters.spec.ts` checks all ten chapters, bilingual directions, model comparison, retries, keyboard/IME input and phone layout.

Fourteen additional workbook passages (16 paragraphs) now have optional English translation panels, including the early-chapter readings and later cloze passages. They start closed, work with a keyboard and without JavaScript, and remain independent of romaji and global reading preferences. Existing Japanese text and every cloze blank remain intact. The added translations live in `src/data/chapter-reading-support.json` and are covered by the older-chapter audit.
