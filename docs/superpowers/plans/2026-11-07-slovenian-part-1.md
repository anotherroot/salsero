# Slovenian, part 1 (foundation and the class's path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every account has a language (English or Slovenian), set from the admin's invite, and everything a person at Follow my class meets is drawn in it — deployable on its own.

**Architecture:** Typed TypeScript catalogs (`src/lib/i18n/en/*`, `sl/*` typed against English), read through one accessor `t()`. The current language comes from a per-request `AsyncLocalStorage` on the server (set in `hooks.server.ts`) and from a module variable in the browser (set by the root layout). Specs run without either and get English, so existing specs keep passing.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Drizzle + SQLite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-slovenian-design.md` (read it first: register, glossary, grammar rules). This plan covers its steps 1 and 2. Step 3 (everything else) and step 4 (the Android app) are later plans.

## Global Constraints

- Two locales: `'en' | 'sl'`. `users.locale` / `invites.locale` null means `'en'`.
- Slovenian register: vikanje in sentences ("Vnesite kodo", "Ste prepričani?"); short imperatives on buttons ("Shrani", "Prekliči").
- Never put a person's name inside a phrase that declines it or a past-tense verb that agrees with it: names go after a colon or a "·" ("Sprememba · Ana · pred 10 min").
- Slovenian plurals by `slCount` (Task 1), never `n === 1 ? a : b`.
- Decimal comma in Slovenian ("0,25×", "1,5 s", "1,2 GB").
- Dates stay hand-built (no `toLocaleDateString`, CLAUDE.md).
- Glossary: the spec's table, kept as a comment block at the top of `src/lib/i18n/sl/index.ts`; use exactly those words.
- What people write (names, notes, comments, song titles) is never translated. The count stays Spanish.
- No module-level variable may hold the language on the server. `setClientLocale` must do nothing when `!browser`.
- A word table that is a top-level constant today (`THEME_LABEL`, `FEEL_WORD`, a tab's label …) becomes a function or is read inside a function, so it is looked up at call time, not at import time.
- Existing specs must keep passing unchanged in English. A spec that changes is a spec whose module's signature changed, nothing else.
- English text in English must not change (the phone screenshots in English stay identical).
- CLAUDE.md hard rules apply: additive `ALTER TABLE … ADD COLUMN` only, data functions take `db` first, nothing under `$lib/server` imported by components, a filled-in form uses `use:guarded`, `PAGE_EPOCH` raised in a commit that breaks what older open pages send.
- `npm run check` passes at the end of every task.

## Review Focus

1. **A signed-out page opened from a Slovenian invite on a fresh phone** (no cookie): Join must be Slovenian from the first paint, and its refusals too. Pinned in Task 3.
2. **Two requests in different languages at once on the server:** each renders in its own. Pinned in Task 1 (`runInLocale` interleaving test).
3. **A Slovenian count of 1, 2, 3, 4, 5, 11, 101, 102, 0** in every counted phrase: right form. Pinned in Task 1 (`slCount`) and in each area's spec.
4. **A Slovenian user hitting an error page or the reload bar:** Slovenian, not English. Pinned in Task 5.
5. **The Settings switch:** after switching, the whole page (tab bar included) redraws in the new language, and the login page after signing out stays in it. Pinned in Task 4.

---

### Task 1: The i18n core

**Files:**
- Create: `src/lib/i18n/locale.ts`, `src/lib/i18n/current.ts`, `src/lib/i18n/plural.ts`, `src/lib/i18n/catalog.ts`, `src/lib/i18n/en/index.ts`, `src/lib/i18n/en/common.ts`, `src/lib/i18n/sl/index.ts`, `src/lib/i18n/sl/common.ts`, `src/lib/server/i18n-request.ts`, `src/lib/i18n/no-english.ts`
- Test: `src/lib/i18n/i18n.spec.ts`, `src/lib/i18n/no-english.spec.ts`, `src/lib/server/i18n-request.spec.ts`

**Interfaces:**
- Produces:
  - `locale.ts`: `type Locale = 'en' | 'sl'`; `LOCALES: readonly Locale[]`; `parseLocale(raw: unknown): Locale | null`; `LOCALE_COOKIE = 'lang'`; `LOCALE_NAME: Record<Locale, string>` = `{ en: 'English', sl: 'Slovenščina' }` (each in its own language, deliberately constant); `requestLocale(i: { user: { locale: Locale | null } | null; cookie: string | undefined; invite: Locale | null }): Locale` — user's locale (null → `'en'`) if signed in; else the invite's; else the cookie's; else `'en'`.
  - `current.ts`: `locale(): Locale`; `setLocaleSource(fn: () => Locale | undefined): void` (the server registers its ALS reader); `setClientLocale(l: Locale): void` (no-op when `!browser`); `withLocale<T>(l: Locale, fn: () => T): T` (sync override, for specs and for code that draws in someone else's language).
  - `plural.ts`: `slForm(n: number): 'one' | 'two' | 'few' | 'other'` (n%100: 1 → one, 2 → two, 3–4 → few, else other); `slCount(n: number, forms: [one: string, two: string, few: string, other: string]): string` → `"${n} ${form}"`.
  - `catalog.ts`: `type Catalog = typeof en`; `t(): Catalog` (the current locale's catalog); `catalogOf(l: Locale): Catalog`.
  - `en/index.ts`: `export const en = { common }` — later tasks add one area each (`format`, `shell`, `entry`, `today`, `exercise`, `lesson`, `comments`, `video`, `settings`, `admin`). `sl/index.ts`: `export const sl: Catalog = { common }`; each `sl/<area>.ts` is typed `Catalog['<area>']`, so a missing key fails `svelte-check`.
  - `common`: the words every area shares: save, cancel, close, back, delete, undo, done, edit, add, remove, yes, no, retry, loading, more (⋯), search, and `decimal(x: number, digits: number): string` (dot in en, comma in sl).
  - `server/i18n-request.ts`: `runInLocale<T>(l: Locale, fn: () => T): T` (an `AsyncLocalStorage<Locale>`); on import, calls `setLocaleSource(() => store.getStore())`.
  - `no-english.ts`: `englishIn(svelteSource: string): string[]` — returns the static English it finds: text nodes and the static values of the attributes `aria-label`, `title`, `placeholder`, `alt`, `label`, `heading`, `subtitle`, `message`, `confirm`, `hint`, after removing `<script>`, `<style>`, comments and `{…}` expressions (nested braces). A string counts when it has a run of two or more Latin letters. Symbols, digits and `·` alone do not count. `no-english.spec.ts` holds `const TRANSLATED: string[] = []` (component paths) and asserts `englishIn(file) == []` for each; every later task appends its components.

- [ ] **Step 1: Write the failing tests** in `i18n.spec.ts`:
  - `slForm`: 1 → one, 2 → two, 3 → few, 4 → few, 5 → other, 0 → other, 11 → other, 101 → one, 102 → two, 103 → few, 111 → other.
  - `slCount(5, ['vaja','vaji','vaje','vaj'])` → `'5 vaj'`; 2 → `'2 vaji'`; 1 → `'1 vaja'`.
  - `t().common.save` is `'Save'` with no source set; `withLocale('sl', () => t().common.save)` is `'Shrani'`, and after it `t()` is English again.
  - `t().common.decimal(1.5, 1)` → `'1.5'`; in sl `'1,5'`.
  - `requestLocale`: signed-in user with `'sl'` beats cookie `'en'`; signed-in with null → `'en'` even with cookie `'sl'`; signed out: invite `'sl'` beats cookie `'en'`; cookie `'sl'` alone → `'sl'`; cookie `'xx'` → `'en'`.
  - In `i18n-request.spec.ts`: two `runInLocale` calls, one `'en'` one `'sl'`, each awaiting a timer before reading `locale()`, interleaved with `Promise.all`, each read its own.
  - In `no-english.spec.ts`: `englishIn('<button aria-label="Close">{t().common.close}</button>')` → `['Close']`; `englishIn('<p>{x}</p><span>·</span>')` → `[]`; `englishIn('<script>const a = "Hi there"</script><b>3 × 2</b>')` → `[]`; `englishIn('<Sheet title="Invite someone">')` → `['Invite someone']`.
- [ ] **Step 2: Run** `npx vitest run src/lib/i18n src/lib/server/i18n-request.spec.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the files above with the interfaces given. `current.ts` keeps an override variable (for `withLocale`), a registered source, and a client variable; `locale()` reads them in that order, then `'en'`.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): the catalogs, the current language, Slovenian plurals`.

### Task 2: The language on the account and the request

**Files:**
- Modify: `src/lib/server/db/schema.ts` (`users.locale`, `invites.locale`, both `text`, nullable, with a doc comment), a generated migration under `drizzle/` (read it: two `ALTER TABLE … ADD COLUMN`, nothing else), `src/app.d.ts` (`SessionUser.locale: Locale | null`), `src/lib/server/auth.ts` (`validateSession` selects it), `src/lib/server/request-user.ts` (`apiDeviceUser` carries it), `src/hooks.server.ts`, `src/app.html` (`lang="%salsa.lang%"`), `src/routes/+layout.server.ts` (returns `locale: Locale`), `src/routes/+layout.svelte` (calls `setClientLocale(data.locale)` at the top of its script, before anything renders)
- Create: `src/lib/server/locale.ts`
- Test: `src/lib/server/locale.spec.ts`, `src/hooks-locale.spec.ts` (or the existing hook spec if one exists)

**Interfaces:**
- Consumes: Task 1 (`requestLocale`, `runInLocale`, `parseLocale`, `LOCALE_COOKIE`).
- Produces:
  - `server/locale.ts`: `setLocale(db: Db, userId: string, l: Locale): void` (checks with `parseLocale`, throws on anything else); `inviteLocaleOf(db: Db, code: string): Locale | null` (the invite row's locale by code hash, live or not; null when none); `setLocaleCookie(cookies: Cookies, l: Locale): void` (path `/`, one year, `sameSite: 'lax'`, `httpOnly: true`).
  - The hook: after `locals.user` is set, `const loc = requestLocale({ user: locals.user, cookie: cookies.get(LOCALE_COOKIE), invite: path === '/join' ? inviteLocaleOf(getDb(), url.searchParams.get('code') ?? '') : null })`; every `return resolve(…)` runs inside `runInLocale(loc, …)`; `transformPageChunk` also fills `%salsa.lang%` with `loc`. The worker branch keeps English (no wrap needed). The 426 body stays English (the native app reads it; part 2 handles the app).
  - Root layout data: `locale: Locale` (the hook's choice; recompute with the same inputs or pass it via `locals.locale: Locale` — add `locale` to `App.Locals`, set in the hook, read by the layout).
- [ ] **Step 1: Write the failing tests:** `setLocale` writes `'sl'` and `validateSession` returns `locale: 'sl'`; `setLocale(db, id, 'xx' as Locale)` throws; `inviteLocaleOf` returns the row's locale for its code and null for an unknown code; a request to `/join?code=<sl invite>` with no cookie renders with `<html lang="sl">` (drive `handle` with a fake `resolve` that returns `transformPageChunk` applied to `'<html lang="%salsa.lang%">'` and reads `locale()` inside; mock `$lib/server/db` with `openDb(':memory:')` as `src/routes/[dance]/dance-wall.spec.ts` does).
- [ ] **Step 2: Run** them — Expected: FAIL.
- [ ] **Step 3: Implement** the schema change, `npm run db:generate`, read the SQL, then the files above.
- [ ] **Step 4: Run** the tests, then `npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): the language on the account, the invite and the request`.

### Task 3: Invite in a language, Join and login keep it, the admin sets it

**Files:**
- Modify: `src/lib/server/invites.ts` (`createInvite(db, adminId, dance, now, locale: Locale)` stores it; `redeemInvite` creates the user with the invite's locale), `src/routes/admin/+page.server.ts` (`invite` action reads `locale` from the form; new action `setLocale` with `userId` and `locale`, guarded by `adminReaches` like `setLimit`), `src/routes/admin/+page.svelte` (the invite button becomes a form with an EN / SLO choice, default SLO; each person's row gets a small language select posting `?/setLocale`), `src/routes/join/+page.server.ts` (on success `setLocaleCookie` with the new account's locale), `src/routes/login/+page.server.ts` (on success `setLocaleCookie(user.locale ?? 'en')`)
- Test: `src/lib/server/invites.spec.ts` (extend), `src/routes/join/join.spec.ts` (extend), `src/routes/admin/admin-page.spec.ts` (extend), `src/routes/login/login.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 2 (`setLocale`, `setLocaleCookie`, `inviteLocaleOf`).
- Produces: `createInvite(db, adminId, dance, now, locale)` — every existing caller passes a locale (the admin page's choice; specs `'en'`).
- [ ] **Step 1: Write the failing tests:** an invite made with `'sl'` → Join creates an account whose `users.locale` is `'sl'` and sets the `lang` cookie to `'sl'`; Join's refusal for a bad password on a Slovenian invite comes back in Slovenian (this needs `entry` words from Task 6 — until then assert the cookie and the column only, and leave a `// Task 6` note in the spec); login sets the cookie from the account; the admin's `setLocale` changes another account's locale in their dance and 404s for an account of the other dance (as `setLimit` does).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** The admin page's English text stays English here (the admin page is translated in part 2), except the new controls, which get `admin` catalog words now (`admin.inviteLanguage`, `admin.language`).
- [ ] **Step 4: Run**, then `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat(i18n): invites carry a language, Join and login keep it`.

### Task 4: The Settings switch

**Files:**
- Modify: `src/routes/settings/+page.server.ts` (action `language`: reads `locale`, `setLocale`, `setLocaleCookie`), `src/routes/settings/+page.svelte` (a Language row at the top of the page, opening the same `ChoiceSheet` the theme uses, options from `LOCALES` labelled by `LOCALE_NAME`; on success `location.reload()`)
- Test: `src/routes/settings/settings-forms.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 2.
- [ ] **Step 1: Write the failing test:** posting `language` with `sl` sets the column and the cookie; with `xx` it fails 400 and changes nothing.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run**, `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat(i18n): the language in Settings`.

### Task 5: Dates, numbers, the schedule's words, the shell and the system screens

**Files:**
- Create: `src/lib/i18n/{en,sl}/format.ts`, `src/lib/i18n/{en,sl}/shell.ts`
- Modify: `src/lib/format.ts` (every exported label function draws from `t().format`: weekdays, months, the day forms, `byteSize` with the decimal comma, `agoText`; `plural` stays, documented as English only and used only inside `en/*` from now on), `src/lib/schedule/words.ts`, `src/lib/schedule/feel.ts` (the face words), `src/lib/nav/tabs.ts` (tab labels), `src/lib/nav/error-view.ts`, `src/lib/nav/pending.ts` if it has words, `src/lib/app-update/view.ts`, `src/lib/app-update/get-app.ts`, the components in `src/lib/components/shell/`, `src/lib/components/system/`, `src/lib/components/ui/` (every built-in word: Sheet's close label, Dialog, `UnsavedDialog`, `ClashSheet`'s fixed words, `SearchField`'s placeholder default, toasts), `src/routes/+error.svelte`, `src/routes/app/` (Get the app), `src/lib/theme/scheme.ts` (`THEME_LABEL` → a function)
- Test: `src/lib/format.spec.ts` (extend), `src/lib/schedule/words.spec.ts` (extend), `src/lib/i18n/no-english.spec.ts` (add these components)

**Interfaces:**
- Consumes: Task 1.
- Produces: `t().format` with at least `weekdaysShort: string[7]` (Sunday first), `weekdays: string[7]`, `monthsShort: string[12]`, `months: string[12]`, `today`, `yesterday`, `tomorrow`, and functions for the forms `format.ts` and `schedule/words.ts` build (`daysAgo(n)`, `inDays(n)`, `backIn(n, unit)`, `ago(n, unit)` …: the builder names them). Slovenian forms: weekdays short `ned pon tor sre čet pet sob`; months short `jan. feb. mar. apr. maj jun. jul. avg. sep. okt. nov. dec.`; `dayLabel` → `"tor, 22. sep."`; `dateLabel` → `"22. sep. 2026"`; "danes", "včeraj", "jutri", "pred 5 min", "čez 3 dni", "čez en teden".
- [ ] **Step 1: Write the failing tests** (in sl via `withLocale`): `dayLabel('2026-09-22')` → `'tor, 22. sep.'`; `dateLabel('2026-09-22')` → `'22. sep. 2026'`; `byteSize(1288490189)` → `'1,2 GB'`; `gapWords(1)` → `'Jutri'`; `gapWords(3)` → `'3 dni'`; `gapWords(2)` → `'2 dneva'`; `gapWords(5)` → `'5 dni'`; `gapWords(21)` → `'3 tedne'`; `backWords(7)` → `'Spet čez en teden'`; `lastDoneLabel(2)` → `'Pred 2 dnevoma'`; `lastDoneLabel(5)` → `'Pred 5 dnevi'`. The English results of the existing specs are unchanged. The shell's and system's components are in `TRANSLATED` and pass.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run**, `npm run check` — PASS.
- [ ] **Step 5: Commit** `feat(i18n): dates, numbers, the schedule's words and the shell in Slovenian`.

### Task 6: The way in: login, Join, welcome, the first run, a class code

**Files:**
- Create: `src/lib/i18n/{en,sl}/entry.ts`
- Modify: `src/routes/login/*`, `src/routes/join/*` (and the `INVITE_REFUSAL` text in `invites.ts`, as a catalog lookup at the call site), `src/routes/welcome/*`, `src/routes/welcome/start/*`, `src/routes/g/[code]/*`, `src/lib/levels/levels.ts` (the levels' words: Sledim svojemu tečaju / Vadim in imam svoje / Vse), `src/lib/levels/first-run.ts`, `src/lib/names.ts` if it has words, `src/lib/components/levels/LevelCards.svelte`, `src/lib/components/system/NameFields.svelte`, `src/lib/components/teams/ClassCodeField.svelte`, `ClassList.svelte`, `MyClass.svelte`, `src/lib/teams/view.ts` (only the lines these components use), `src/lib/server/join-code.ts` refusals, `src/lib/components/positions/` `HowBody` only if the first run shows it
- Test: `src/lib/levels/levels.spec.ts`, `src/lib/levels/first-run.spec.ts`, `src/routes/join/join.spec.ts` (the `// Task 6` assertion from Task 3), `no-english.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 5.
- [ ] **Step 1: Write the failing tests:** in sl, the three level names are exactly the spec's; Join's empty-email refusal is Slovenian when the request's locale is `'sl'` (run the action inside `runInLocale('sl', …)`); the first run's refusals of a bad class code are Slovenian; these components are in `TRANSLATED`.
- [ ] **Step 2–4:** run (FAIL), implement, run and `npm run check` (PASS).
- [ ] **Step 5: Commit** `feat(i18n): the way in, in Slovenian`.

### Task 7: Today

**Files:**
- Create: `src/lib/i18n/{en,sl}/today.ts`
- Modify: `src/routes/[dance]/(today)/**` (the list, Coming up), `src/lib/components/today/*`, `src/lib/exercises/today.ts`, `src/lib/exercises/today-pane.ts`, `src/lib/schedule/today-list.ts`, `src/lib/schedule/coming-up.ts`, `src/lib/schedule/picks.ts` (any words), `src/lib/server/today-picks.ts` refusals
- Test: the existing specs of those modules (extend each with a few sl cases: a counted line for n = 1, 2, 3, 5), `no-english.spec.ts`

**Interfaces:** Consumes: Tasks 1, 5 (`t().format`, the schedule's words).
- [ ] **Step 1: Write the failing tests:** e.g. Today's "N exercises a day" / Next N / nothing-left words in sl for n = 1, 2, 3, 5; the band headings (Due, Done today, Not yet due, Inactive) in sl; Not today's Undo toast; components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): Today in Slovenian`.

### Task 8: The exercise page and the log popup

**Files:**
- Create: `src/lib/i18n/{en,sl}/exercise.ts`
- Modify: `src/routes/[dance]/(today)/exercises/**`, `src/lib/components/exercises/**` (LogShell, the faces, SetList, LastTime, `kinds/*`), `src/lib/exercises/kinds.ts` (type names), `tile.ts`, `log-view.ts`, `exercise-page.ts`, `practice.ts` words, `src/lib/components/player/PracticePanel.svelte` and the chips it uses (`SpeedChips`, `CountChips`, `ClaveChips`), `src/lib/server/from-class.ts` words if any, the log actions' refusals
- Test: `log-view.spec.ts`, `exercise-page.spec.ts`, `kinds.spec.ts` (extend with sl cases), `no-english.spec.ts`

**Interfaces:** Consumes: Tasks 1, 5, 7.
- [ ] **Step 1: Write the failing tests:** the four faces' words in sl; the log footer's states; a range refusal ("minutes 0–600") in sl; `setSummary` in sl (`'5 min · 12 ponovitev'`, 1 → `'1 ponovitev'`, 2 → `'2 ponovitvi'`, 3 → `'3 ponovitve'`); components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the exercise page and the log popup in Slovenian`.

### Task 9: The simple lesson page and comments

**Files:**
- Create: `src/lib/i18n/{en,sl}/lesson.ts`, `src/lib/i18n/{en,sl}/comments.ts`
- Modify: `src/lib/components/lessons/SimpleLesson.svelte`, the lesson route's parts drawn at Follow my class (`src/routes/[dance]/lessons/` layout and list as seen then: `LessonList`, `LessonRow`, `src/lib/lessons/*` lines they use), `src/lib/components/comments/*`, `src/lib/comments/view.ts`, comment API refusals in `src/lib/server/comments.ts` and its routes
- Test: `src/lib/comments/view.spec.ts`, `src/lib/lessons/*.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:** Consumes: Tasks 1, 5.
- [ ] **Step 1: Write the failing tests:** "N new" comments in sl for 1, 2, 3, 5 ("1 nov", "2 nova", "3 novi", "5 novih"); the 1–1000 body refusal in sl; the "Teacher" badge has a Slovenian word (the builder's pick; it sits beside a name, so it must read right for a woman as well as a man, e.g. "vodja tečaja"); the Lessons list's month headings in sl ("november 2026"); components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the class's lesson page and comments in Slovenian`.

### Task 10: The video player and the inline video

**Files:**
- Create: `src/lib/i18n/{en,sl}/video.ts`
- Modify: `src/lib/components/video/*`, `src/lib/video/chrome.ts`, `caption.ts`, `inline.ts`, `spots.ts` (labels), `keys.ts` (only displayed words), the inline video component(s) these use
- Test: `src/lib/video/chrome.spec.ts`, `inline.spec.ts`, `spots.spec.ts` (extend), `no-english.spec.ts`

**Interfaces:** Consumes: Tasks 1, 5 (`common.decimal` for "0,25×").
- [ ] **Step 1: Write the failing tests:** the speed labels in sl (`'0,25×'`, `'0,5×'`, `'1×'`); the delete sheet's copy; a section's label; components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): the video player in Slovenian`.

### Task 11: Settings (and My count)

**Files:**
- Create: `src/lib/i18n/{en,sl}/settings.ts`
- Modify: `src/routes/settings/+page.svelte`, `+page.server.ts` refusals, `src/lib/settings/view.ts`, `src/routes/voice/**` and `src/lib/voice/grid.ts`, `recording.ts` words (My count), `src/lib/storage-view.ts` (the storage line Settings shows), `src/lib/components/ui/` pieces only Settings uses
- Test: `src/lib/settings/view.spec.ts`, `src/lib/storage-view.spec.ts`, `no-english.spec.ts`

**Interfaces:** Consumes: Tasks 1, 4, 5.
- [ ] **Step 1: Write the failing tests:** the reminder rule's words in sl; a paired phone's line; the storage line in sl with a decimal comma; Settings and My count components in `TRANSLATED`.
- [ ] **Step 2–4:** FAIL, implement, PASS + `npm run check`.
- [ ] **Step 5: Commit** `feat(i18n): Settings and My count in Slovenian`.

### Task 12: Look at it, fix what is left, write it down

**Files:**
- Modify: `scripts/shots/shots.sh` (a `--locale sl|en` flag: sets the admin's `users.locale` in the db copy), `scripts/shots/README.md`, any file where English is found, `CLAUDE.md` (Layout: `src/lib/i18n/`, `src/lib/server/i18n-request.ts`, `server/locale.ts`; a hard rule: "Words go through `t()`; a new screen's words go in both catalogs"), `docs/superpowers/specs/2026-09-22-salsa-app-design.md` (a short section on the two languages pointing at the spec)

- [ ] **Step 1:** Set the admin's level to `follow` in the db copy (the same way the flag sets the locale; add `--level follow` if needed) and shoot `pages.txt`, `pages-signed-out.txt`, `pages-welcome.txt`, `pages-card.txt` at 390×844 with `--locale sl`, plus the scenes of the log popup and the player (`--scenes`). Expected: every page `ok`, no `OVERFLOW`.
- [ ] **Step 2:** Read every screenshot of the Follow my class path. List every English word left on it (the count's Spanish and people's own text excepted) and every Slovenian line that is cut off or wraps badly (Slovenian runs ~20 % longer).
- [ ] **Step 3:** Fix each, with its component added to `TRANSLATED`. Re-shoot those pages; Expected: none left.
- [ ] **Step 4:** Shoot the same pages with `--locale en` and `diff` them against shots taken on `master` (before this branch). Expected: no differences.
- [ ] **Step 5:** Update CLAUDE.md and the design spec; `npm run check` — PASS.
- [ ] **Step 6: Commit** `docs(i18n): the two languages; fixes from the Slovenian screenshots`.
