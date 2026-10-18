# Japanese Lesson Reviewer

A personal study site for Japanese lessons. You can search vocabulary, grammar, kana and kanji across all documents, read each chapter from its lessons through to the answer key, and open the original reviewer documents.

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

`e2e/smoke.spec.ts` is a short check that a live site works: the home page and search, one chapter, Kana, Kanji and document page, a section anchor opened directly, and no page errors, console errors or failed requests. It doesn't compare counts with your local data, so it passes even when the deployed data differs from your checkout.

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
| `chapter` | `1` to `10`, `gen` (General), `kana`, `kanji` | all |

- Example: `/?q=gakkou&category=vocab&chapter=1`
- Unknown values fall back to the default. Other parameters and the `#hash` are kept.
- Typing replaces the current history entry. Filters, Clear and Reset add one, so Back undoes them.
- On the home page, Ctrl+K (⌘K on a Mac) puts the cursor in the search box.

## Document tags

Each row in the home page's Documents list shows what's inside the document: Grammar, Vocabulary, Kana & Kanji, Practice and Answers. They come from the search entries in `lesson-data.json` (every entry whose `d` matches the document's `n`, using its `c` category), worked out when the page is built (`src/lib/documents.ts`). Titles and the document's `kind` aren't used for this; `kind` (Reviewer, Answer key, ...) is shown separately under the title.

## Interactive exercises

Chapters 1 and 2 have an **Interactive practice** panel at the top of their Exercises section: **Particles** (fill in the marker) and **Vocabulary** (match each Japanese word to its meaning). The original exercise tables and answer keys stay below it. Answers are checked in the browser and not saved: reloading starts fresh, and the bookmark storage isn't touched.

The questions live in `src/data/exercises.json`, copied from `chapters.json` word for word (the Question, Answer and Why cells), with each question's source part, answer key part and number. `tests/exercises.test.mjs` checks every question against the original tables.

To add another chapter: add an entry to `src/data/exercises.json` like the existing ones (set ids `c<chapter>-particles` and `c<chapter>-vocabulary`, question ids `<set id>-<number>`), fill in `accepted` deliberately (romaji and kana, plus any alternative the answer key itself allows), then extend the expected chapter list in the first test. Run `npm test`: it fails on any word that doesn't match the source.

## Bookmarks and Continue studying

Reader pages have a **Bookmark page** button, and a **Bookmark section** button after you jump to a section from On this page. The dashboard shows your bookmarks and the last study page you opened.

- Saved only in this browser, in localStorage under `japanese-reviewer:study`, as JSON with a `version` number (currently 1). Nothing is sent to a server, so bookmarks don't follow you to another browser or device.
- Saved data that can't be read is ignored and replaced on the next change. Bookmarks to pages that no longer exist are hidden, and a bookmark whose section is gone opens its page instead.
- If the browser blocks storage (some private modes, or site data turned off), even after the page has loaded, bookmarks still work until you close the tab, and the page says so.
- To clear everything: in DevTools, Application, Local Storage, delete `japanese-reviewer:study`.

## Project layout

| Path | What it is |
| --- | --- |
| `src/data/` | The four JSON datasets: lesson-data (documents and search entries), chapters, kana, kanji |
| `src/app/` | Routes: `/`, `/chapters/[ch]`, `/kana/[ch]`, `/kanji/[ch]`, `/lessons/[n]` |
| `src/components/` | Shell, dashboard cards, search, the shared reader (ReaderLayout, TableOfContents, LessonContent), and the bookmark parts (BookmarkControls, StudyShelf, use-study) |
| `src/lib/` | Search helpers, the server-only search payload, outline builders, bookmark storage (`study.ts`), document tags (`documents.ts`), exercise grading (`exercises.ts`) and the server-only exercise bank (`exercise-bank.ts`) |
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
