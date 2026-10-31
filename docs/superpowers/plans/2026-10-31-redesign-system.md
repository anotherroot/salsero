# Redesign: Settings, My count, sign-in and system Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw Settings, My count (`/voice`), Sign in, pairing, the share
target and the error pages in the new look; make Settings save on change with
a "Saved" toast; let a deleted voice take and a removed paired phone come back
with Undo; give the app designed 404 / offline / server-error pages; and close
the foundation's carried items (NavProgress on band-less pages, the Android
navigation-bar strip, the Switch's off-track contrast).

**Architecture:** Every screen here becomes a `Screen` (band + sheet), so no
page is band-less and the cream NavProgress always lands on a band. The logic
each screen shows — tempo states, the recording's count dots, My count's back
target, the error page's words, Settings' reminder and device lines — lives in
pure modules with specs; the pages only render them. Undo for a removed phone
or a deleted take is a server round trip: the row is deleted at once and held
in memory for 60 s by a small `Hold`, and an Undo action puts it back (a
take's file is unlinked only when its hold expires). The Android shell learns
from the page, through a WebMessageListener, whether the strip under the
navigation bar should be the tab bar's colour or the page's.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Tailwind 4, Vitest (node only),
Kotlin (the WebView shell), Playwright screenshots via
`$S/tools/page.sh`.

**Spec:** `docs/superpowers/specs/2026-10-31-redesign-design.md` — "Settings,
My count, sign-in and system", "Patterns used across screens" (the
`+error.svelte`, the cream progress bar), "Additions" (Settings saves on
change; voice take and paired phone delete with Undo), "Calls made while
writing this" (My count's back returns where it was opened from). Screens:
`docs/superpowers/design-kit/screens/system.py`; previews `$S/previews/s-system-0.png`,
`s-system-1.png`, `s-system-2.png` (light and dark side by side).

**This is plan 12 of 13.** All plans land on branch `app-icons`, deployed once
when the last is done. After this only Cleanup remains.

`$S` below is `/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad`.
The dev server on http://localhost:20000 serves this worktree; never start
another. Screenshot scripts go in `$S/tools/`, shots in `$S/shots/system-N/`.

## Global Constraints

- Colours come from `tokens.ts` / `layout.css` only; no hex in components.
- Small text ≥ 4.5:1 against its background, large (≥ 24 px) ≥ 3:1, in all four themes.
- Small text on the light salsa band is white `#ffffff`; band title and icons are cream `#FFF3E4`.
- Fonts: Bricolage Grotesque (titles, hero, big numbers) and Manrope (everything else), self-hosted.
- Icons: 24 px grid, 2 px round strokes; filled variants for the four tabs; tab bar icons 28 px.
- Radii: 8 xs, 12 sm, 14 field, 16 group, 22 card, 28 sheet, pill. Spacing 4, 8, 12, 16, 20, 24, 32, 48.
- Focus: 2 px accent ring + 4 px halo (accent at 20 %); around a filled control, a 2 px gap first.
- No dance switch anywhere; no dance name in a header.
- Touch targets ≥ 44 px.
- Respect `prefers-reduced-motion` for every animation.
- Project rules from `CLAUDE.md` hold: `use:guarded` for filled-in forms, no browser `confirm()`, nothing from `$lib/server` in components, `npm run check` must pass.

This area adds:

- Every feature the six screens have today survives: both default-style
  settings (now one per dance, each edited from its own dance), the reminder
  time and its "off", the video size, the paired-phone list and Remove, Sign
  out as a POST, every My count stage (arming, recording with Stop and Redo,
  choosing with Listen, Keep and Record again), the unsaved-take guard, the
  login's `next`, rate limit and identical refusal, pairing's one tap and app
  link, the share target's 30 recent lessons and `salsa://upload` links.
- Settings has no Save button and no `use:guarded` form: each control posts on
  change through `act()` (`src/lib/components/routines/act.ts`) and shows
  `Toast` "Saved" (check icon). A refusal shows the server's message in the
  toast, no action, and the control shows the server's value again.
- Small accent text uses `text-accent-text`, never bare `text-accent`.
- Colour classes are never appended after `button()` / `iconButton()` output
  (their `text-ink` wins); use `.replace('text-ink', 'text-danger')` or literal classes.
- `/dev/kit` gets nothing more than it has.
- Copy, exactly (from the board): "Settings", "Practice", "My count",
  "<n> of 21 tempos in your own voice", "New figures start on", "The style a new
  figure starts on. You can change it on the figure.", "Style", "Android app",
  "Daily reminder", "What is due, as a notification", "Time", "Compress videos
  to", "Read by the phone app when it opens.", "Paired phones", "Paired <d Mon
  yyyy> · last used today", "Remove", "Account", "Signed in", "Sign out",
  "Saved"; "Record yourself counting and the player uses your voice. A tempo
  with nothing recorded uses the built-in count.", "Tempos · <n> of 7
  recorded", "Recorded", "Half recorded · counts 1 2 3", "Not recorded",
  "Record", "Redo", "Recorded takes", "<bpm> BPM · counts 1 2 3", "1 2 3 · 5 6
  7 · phrase A", "The microphone was refused", "Allow it for this app in the
  phone’s settings, then try again.", "Put headphones on first", "Through a
  speaker the click gets recorded along with your voice.", "How it goes", "One
  bar of clicks to find the tempo.", "Count <b>1 2 3 · 5 6 7</b> out loud for 4
  bars.", "Start", "Recording", "Bar 2 of 4", "Say <b>5</b> now", "Stop keeps
  the whole bars you counted. Redo throws them away and starts the count-in
  again.", "Stop", "Pick the bars", "Pick the best bar for each half. Listen
  before you keep it: a rushed or muttered one is worse than the built-in
  voice.", "First half", "Second half", "Counts 1 2 3", "Bar 1", "Listen to bar
  1", "Nothing usable in this half.", "Keep these", "Saving…", "Record again",
  "Kept both halves for 152 BPM"; "Sign in", "Welcome back. Sign in to
  practise.", "Email", "Password", "Signing in…", "Registration is closed.";
  "Pair the app", "Pair this phone", "Lets the app upload videos in the
  background and remind you what is due. You can remove it again in
  Settings.", "Paired", "Opening the app now. If it does not open by itself,
  tap the button.", "Open the app"; "Add to a lesson", "Compressed and
  uploaded in the background", "Recent lessons", "No lessons yet", "Make one in
  Lessons first, then share the video again."; "Not found", "ERROR 404",
  "Nothing here", "This page does not exist, or what it showed was deleted.",
  "Go to Today", "Offline", "You’re offline", "This page needs the server.
  Check the connection and try again; nothing you saved is lost.", "Try
  again", "Error", "ERROR 500", "Something went wrong", "The server could not
  open this page. Try again in a moment."

## Review Focus

1. **Undo after the hold ran out** (a slow tap, or the server restarted): Undo answers "Too late to undo." and inserts nothing; a take's file is unlinked when its hold expires, not before. Pinned by the `Hold` expiry tests (Task 1) and the `restoreTake` / `restoreDevice` action tests (Tasks 2, 4).
2. **Undo a take after that tempo was recorded again:** the newer take stays, Undo is refused with "A newer take holds that slot now.", and the old file is unlinked at once. Pinned in Task 4's action test.
3. **The reminder switch with an empty time field:** turning it on with no saved time posts 19:30; a time field cleared while on posts nothing (the field shows the saved time again). Pinned by `reminderToSave` tests (Task 2).
4. **My count's `from` as an open redirect:** `https://evil.example`, `//evil.example/salsa/player`, `/salsa/figures` and a garbled value all go back to Settings; only `/<dance>/player…` goes back to Practice. Pinned by `voiceBack` tests (Task 4).
5. **Another user's paired phone:** `removeDevice` / `restoreDevice` with another user's id is a 404 and touches nothing; a held phone is only restorable by the user who removed it. Pinned in Task 2's action test.

---

### Task 1: Switch contrast, a toast icon, and the undo hold

**Files:**
- Modify: `src/lib/components/ui/Switch.svelte`, `src/lib/components/ui/Toast.svelte`, `src/lib/components/ui/styles.ts`
- Modify: `src/lib/theme/tokens.ts`, `src/routes/layout.css` (one token)
- Create: `src/lib/server/undo-hold.ts`
- Test: `src/lib/theme/tokens.spec.ts`, `src/lib/components/ui/styles.spec.ts`, `src/lib/server/undo-hold.spec.ts`

**Interfaces:**
- Produces:
  - `SWITCH_TRACK` in `styles.ts` — the track's class string, off = `bg-muted`, on = `peer-checked:bg-accent`.
  - `Switch` gains `onchange?: (checked: boolean) => void` (called after the bound value changed).
  - `Toast`'s `toast` gains `icon?: IconName` and `tone?: 'done'`: a 22 px leading icon, `text-inverse-done` when `tone === 'done'`, else `text-inverse-ink`.
  - Token `inverse-done` (neutral, both dances): light `#5cc98f`, dark `#1e7a4f` — the kit's toast check colour.
  - `class Hold<T> { constructor(ttlMs: number, onExpire?: (value: T) => void); put(key: string, value: T): void; take(key: string): T | null }` and `export const UNDO_MS = 60_000`.

- [ ] **Step 1: Write the failing tests.**

  `tokens.spec.ts`:
  ```ts
  it('keeps the switch off track and the toast check visible (non-text, 3:1)', () => {
    for (const d of DANCE_SLUGS) for (const s of ['light', 'dark'] as const) {
      const t = THEMES[d][s];
      for (const bg of [t.surface, t.ground, t.sheet, t.raised])
        expect(contrast(t.muted, bg), `${d} ${s}`).toBeGreaterThanOrEqual(3);
      expect(contrast(t['inverse-done'], t['inverse-bg'])).toBeGreaterThanOrEqual(3);
    }
  });
  ```
  `styles.spec.ts`: `SWITCH_TRACK` contains `bg-muted` and `peer-checked:bg-accent` and not `bg-field-line`.
  `undo-hold.spec.ts` (`vi.useFakeTimers()`):
  ```ts
  it('hands a held value back once', () => { h.put('a', 1); expect(h.take('a')).toBe(1); expect(h.take('a')).toBeNull(); });
  it('forgets after ttl and calls onExpire once', () => {
    const gone = vi.fn(); const h = new Hold<number>(60_000, gone);
    h.put('a', 1); vi.advanceTimersByTime(59_999); expect(gone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(gone).toHaveBeenCalledWith(1); expect(h.take('a')).toBeNull();
  });
  it('does not expire what was taken', () => { /* put, take, advance 60 s → onExpire not called */ });
  it('expires the old value when a key is put again', () => { /* put a=1, put a=2 → onExpire(1) at once; take → 2 */ });
  ```
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/theme src/lib/components/ui src/lib/server/undo-hold.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Add `inverse-done` to `TOKEN_NAMES`, the `TokenName` type, the four themes and `layout.css` (both schemes; same value for both dances). `Switch.svelte` takes its track classes from `SWITCH_TRACK` (keep the thumb white, `peer-disabled:opacity-50`, the focus ring and the 20 px slide); `onchange` on the input. `Hold`: a `Map<string, { value: T; timer: ReturnType<typeof setTimeout> }>`; `put` clears and expires any previous value for the key; each timer `.unref?.()` so a held value never keeps the process alive. Header comment: the delete already happened; this only remembers what Undo needs for `UNDO_MS` (well past the toast's 6 s), in memory, so a restart forgets it — Undo then says "Too late to undo.".
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): a switch you can see when off, a toast icon, and an undo hold`.

### Task 2: Settings on the server — save on change, one dance, Undo for a phone

**Files:**
- Create: `src/lib/settings/view.ts`, `src/lib/voice/grid.ts`
- Modify: `src/lib/server/devices.ts`, `src/routes/settings/+page.server.ts`, `src/lib/types.ts` (if `DeviceRow` needs the snapshot type)
- Test: `src/lib/settings/view.spec.ts`, `src/lib/voice/grid.spec.ts`, `src/lib/server/devices.spec.ts`, `src/routes/settings/settings-forms.spec.ts`

**Interfaces:**
- Consumes: `Hold`, `UNDO_MS` (Task 1).
- Produces:
  - `src/lib/settings/view.ts`: `DEFAULT_REMINDER = '19:30'`; `reminderToSave(on: boolean, time: string): string | null` — `''` (turn off) when `!on`; the time when on and it matches `HH:MM`; `null` (post nothing) otherwise. `deviceMeta(paired: string, lastUsed: string | null, today: string): string` — days are `YYYY-MM-DD`.
  - `src/lib/voice/grid.ts`: `interface TakeKey { id: number; pattern: CountPattern; bpm: number; phrase: 'a' | 'b' }`; `type TempoState = { state: 'done' } | { state: 'half'; half: 'a' | 'b' } | { state: 'none' }`; `tempoState(takes: readonly TakeKey[], pattern: PhrasePattern, bpm: number): TempoState`; `ownVoiceSummary(takes: readonly TakeKey[]): string`.
  - `devices.ts`: `type DeviceSnapshot = { userId: string; label: string; tokenHash: string; createdAt: number; lastUsedAt: number | null }`; `removeDevice(db, userId, id): DeviceSnapshot | null` (was boolean); `restoreDevice(db, userId, snap): boolean` (inserts a new row; false when `snap.userId !== userId` or the hash is already present).
  - Settings load: `{ dance: DanceSlug; defaultStyle: string; device: { reminderMinute: number | null; shortSide: VideoShortSide }; devices: { id: number; label: string; meta: string }[]; ownVoice: string }`.
  - Settings actions (all `fail(400, { message })` on bad input, 404 for an id that is not the user's): `style` (`dance`, `style`), `reminder` (`reminder`: `''` or `HH:MM`), `videoSize` (`shortSide`), `removeDevice` (`id` → `{ removed: id }`), `restoreDevice` (`id` → `{ ok: true }`, or `fail(410, { message: 'Too late to undo.' })`). The old `styles` and `app` actions go.

- [ ] **Step 1: Write the failing tests.**

  `view.spec.ts`:
  ```ts
  expect(reminderToSave(false, '07:05')).toBe('');
  expect(reminderToSave(true, '07:05')).toBe('07:05');
  expect(reminderToSave(true, '')).toBeNull();
  expect(reminderToSave(true, '7:5')).toBeNull();
  expect(reminderToSave(true, DEFAULT_REMINDER)).toBe('19:30'); // on, with no saved time
  expect(deviceMeta('2026-10-28', '2026-10-31', '2026-10-31')).toBe('Paired 28 Oct 2026 · last used today');
  expect(deviceMeta('2026-10-28', '2026-10-30', '2026-10-31')).toBe('Paired 28 Oct 2026 · last used yesterday');
  expect(deviceMeta('2026-10-28', '2026-10-01', '2026-10-31')).toBe('Paired 28 Oct 2026 · last used 1 Oct 2026');
  expect(deviceMeta('2026-10-28', null, '2026-10-31')).toBe('Paired 28 Oct 2026');
  ```
  `grid.spec.ts`:
  ```ts
  const k = (pattern, bpm, phrase, id = 1) => ({ id, pattern, bpm, phrase });
  expect(tempoState([], 'salsa', 120)).toEqual({ state: 'none' });
  expect(tempoState([k('salsa', 164, 'a')], 'salsa', 164)).toEqual({ state: 'half', half: 'a' });
  expect(tempoState([k('salsa', 120, 'a'), k('salsa', 120, 'b')], 'salsa', 120)).toEqual({ state: 'done' });
  expect(tempoState([k('son', 120, 'a'), k('son', 120, 'b')], 'salsa', 120)).toEqual({ state: 'none' });
  expect(ownVoiceSummary([])).toBe('0 of 21 tempos in your own voice');
  expect(ownVoiceSummary([k('salsa',120,'a'), k('salsa',120,'b'), k('all',191,'a'), k('all',191,'b'), k('son',140,'a')]))
    .toBe('2 of 21 tempos in your own voice'); // a half does not count
  ```
  `devices.spec.ts`: change the two `removeDevice` assertions to `not.toBeNull()` / `toBeNull()`; add "removes and restores a phone: the old token signs in again" (`createDeviceToken` → `removeDevice` → `userForDeviceToken` null → `restoreDevice` true → `userForDeviceToken` is u1) and "never restores into another user" (`restoreDevice(db, 'u2', snap)` false).
  `settings-forms.spec.ts` (mock `getDb` as `lesson-forms.spec.ts` does; `post(fields, user = USER, cookie = 'dance=bachata')` builds a `cookies` stub with `get`):
  - load with the bachata cookie: `dance` `'bachata'`, `defaultStyle` one of bachata's styles, `ownVoice` `'0 of 21 tempos in your own voice'`.
  - `style` `{ dance: 'bachata', style: 'sensual' }` → `defaultStylesFor(db, 'u1').bachata === 'sensual'`, salsa unchanged; `{ dance: 'bachata', style: 'son' }` → `fail(400)`.
  - `reminder` `'07:30'` → `deviceSettings().reminderMinute === 450`; `''` → `null`; `'25:00'` → `fail(400)`.
  - `videoSize` `'720'` → 720; `'500'` → `fail(400)`.
  - `removeDevice` then `restoreDevice` with the same id → the token signs in again and `listDevices` has one row; a second `restoreDevice` → `fail(410)` with "Too late to undo.".
  - Review Focus 5: user u2 posting u1's id to `removeDevice` → 404 and u1's row remains; u1 removes, u2 posts `restoreDevice` with that id → `fail(410)` (the hold is keyed by user) and nothing inserted; u1's Undo still works afterwards.
  - Review Focus 1: `vi.useFakeTimers()`, remove, advance 60 s, `restoreDevice` → `fail(410)`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/settings src/lib/voice/grid.spec.ts src/lib/server/devices.spec.ts src/routes/settings` — Expected: FAIL.
- [ ] **Step 3: Implement.** `deviceMeta` uses `dateLabel` and `daysBetween`. `ownVoiceSummary` counts `done` over `PHRASE_PATTERNS × TEMPO_LADDER` (21). `removeDevice` selects the row (with `tokenHash`) scoped to the user, deletes it, returns the snapshot. Settings server: `dance` from the `DANCE_COOKIE` (`isDanceSlug`, else `DEFAULT_DANCE` — same rule as the root layout; comment why: `/settings` has no dance in its URL and Today links to it plain). `devices` → `meta: deviceMeta(localDay(createdAt), lastUsed ? localDay(lastUsed) : null, localDay(Date.now()))` in the user's zone. Module-level (not exported) `const removed = new Hold<DeviceSnapshot>(UNDO_MS)` keyed `${userId}:${id}`. `style` validates `isDanceSlug` and `DANCES[dance].styles`. Keep the "hard delete: a token is a credential" comment and add: the snapshot never leaves the server — the page only ever sees the id.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): save each setting on its own, this dance's style only, Undo for a removed phone`.

### Task 3: The Settings screen

**Files:**
- Create: `src/lib/components/system/LeadTile.svelte`, `src/lib/components/system/ChoiceSheet.svelte`
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: Task 2's load and actions; `SWITCH_TRACK`/`Switch.onchange`, `Toast` icon (Task 1); `act` from `$lib/components/routines/act.ts`; `Screen`, `BandButton`, `Sheet`, `GROUP`, `ROW`, `SECTION_LABEL`, `button`.
- Produces:
  - `<LeadTile icon: IconName />` — 36 × 36, radius 10, `bg-accent-soft`, 20 px icon `text-accent-text`, `aria-hidden`.
  - `<ChoiceSheet open title intro? legend options: readonly { value: string; label: string }[] value onpick: (value: string) => void onclose />` — a `Sheet` holding `intro` (15 px `text-ink-2`) and a `fieldset` (legend 13/700 `text-muted`, `px-4 pb-2`) of radio rows in a `GROUP` (min-h 52, label 16/600, native radio 22 px with `accent-color: var(--color-accent)`). Picking calls `onpick`; the caller closes it.

- [ ] **Step 1: The band.** `<Screen title="Settings">` with `left` = `BandButton icon="back" label="Back to Today" href={`/${data.dance}`}`. `<title>Settings · {DANCES[data.dance].label}</title>`. Delete the old header and both `use:guarded` forms.
- [ ] **Step 2: Practice.** `SECTION_LABEL` "Practice", then a `GROUP`: an `<a href="/voice">` row (`ROW.replace('min-h-14', 'min-h-16')`): `LeadTile icon="mic"`, title "My count" 16/700, meta `data.ownVoice` 13 `text-muted`, `chevron-right` 20 `text-chevron`; then a picker row (`<button>`, min-h 58, `pl-4 pr-3.5`): "New figures start on" 16/700 `text-ink` left, `styleLabel[defaultStyle]` 15/600 `text-muted` and `chevron-right` right. It opens `ChoiceSheet` (title "New figures start on", intro "The style a new figure starts on. You can change it on the figure.", legend "Style", this dance's styles only). `onpick` closes the sheet, then `act('style', { dance, style })`.
- [ ] **Step 3: Android app.** Section label (14 px above) "Android app", `GROUP`: row "Daily reminder" / "What is due, as a notification" with `LeadTile icon="bell"` and `Switch label="Daily reminder"` trailing (`pr-1.5`); row "Time" (min-h 60, no lead tile, label `text-disabled-ink` when off) with `<input type="time" aria-label="Reminder time">` as a pill: `h-11 w-24 rounded-full bg-field text-center font-sans text-[18px] font-extrabold tabular-nums text-ink disabled:bg-disabled-bg disabled:text-disabled-ink`, disabled while off; picker row "Compress videos to" / "480p" opening `ChoiceSheet` (title "Compress videos to", legend "Size", `VIDEO_SHORT_SIDES` as "480p"/"720p"/"1080p") posting `act('videoSize', { shortSide })`. Under the group, 13 px `text-muted`, `px-4 pt-0.5`: "Read by the phone app when it opens." Page state: `on` and `time` seeded from `data.device` (`time = clockLabel(minute) || DEFAULT_REMINDER`), re-seeded whenever `data.device` changes. The switch's `onchange` and the time's `change` call `reminderToSave(on, time)`; `null` → put `time` back to the saved value and post nothing; otherwise `act('reminder', { reminder })`.
- [ ] **Step 4: Paired phones and Account.** Only when `data.devices.length`: label "Paired phones", `GROUP` of rows with `LeadTile icon="phone"`, the label, `meta`, and a `button('danger-text', 'sm')` "Remove" with `aria-label="Remove {label}"`: `act('removeDevice', { id })`, then the toast "{label} removed" with action "Undo" → `act('restoreDevice', { id })`. Label "Account", `GROUP` row: `LeadTile icon="solo"`, `data.user.email`, meta "Signed in", trailing a plain `<form method="POST" action="/logout">` (keep its comment) with `button('tertiary', 'sm')` + `logout` 18 "Sign out".
- [ ] **Step 5: Toasts.** One page `Toast` at `bottom="calc(1rem + env(safe-area-inset-bottom))"`. After each `act`: success → `{ message: 'Saved', icon: 'check', tone: 'done' }`; a remove → the "{label} removed" toast with Undo; a successful Undo → no toast (the row is back); `failure` → `{ message: result.data.message }` without action (act already reloaded, so the controls show the server's values; on status 0 re-seed them from `data`).
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** `FULL=1 $S/tools/page.sh $S/shots/system-3 /settings` with the salsa cookie, and again after visiting `/bachata` (write `$S/tools/system-settings.py` from `sheet.py`: visit `/bachata` first, then `/settings`; open the style sheet; tap a style and shoot the "Saved" toast; focus the time field; turn the reminder off and shoot the disabled Time row). Pair a fake phone first (POST `/device/pair?dance=salsa` from the script) so the list shows; tap Remove (toast "Salsa app removed · Undo"), then Undo (row back). Compare with "Settings", "Settings · time focused", "Settings · style picker" in `s-system-0.png`, light and dark: the switch's off track now reads darker than the board — that is this plan's call.
- [ ] **Step 8: Commit** `feat(settings): the Settings screen in the new look, saving on change`.

### Task 4: My count — the list, its back target, and Undo for a take

**Files:**
- Create: `src/lib/voice/back.ts`
- Modify: `src/lib/voice/grid.ts`, `src/lib/server/countTakes.ts`, `src/routes/voice/+page.server.ts`, `src/routes/voice/+page.svelte`
- Test: `src/lib/voice/back.spec.ts`, `src/lib/voice/grid.spec.ts`, `src/lib/server/countTakes.spec.ts` (create if absent), `src/routes/voice/voice-forms.spec.ts`

**Interfaces:**
- Consumes: `Hold`, `UNDO_MS`, `Toast` icon (Task 1); `tempoState`, `TakeKey` (Task 2).
- Produces:
  - `back.ts`: `myCountHref(from?: string, pattern?: PhrasePattern): string` — `/voice`, plus `?from=<encoded>` and/or `pattern=<p>`; `voiceBack(from: string | null): { href: string; label: 'Back to Settings' | 'Back to Practice' }`. **Practice (plan 10) links its Voice row with `myCountHref(page.url.pathname + page.url.search, pattern)`.**
  - `grid.ts` adds: `tempoMeta(s: TempoState, pattern: PhrasePattern): { text: string; tone: 'done' | 'status' | 'muted' }`; `recordedLabel(takes, pattern): string`; `takeRows(takes: readonly TakeKey[], pattern: PhrasePattern): { id: number; title: string; meta: string; deleteLabel: string; deleted: string }[]` (bpm then phrase order); `keptMessage(bpm: number, halves: readonly ('a' | 'b')[], pattern: PhrasePattern): string`.
  - `countTakes.ts`: `deleteCountTake(db, id): CountTake | null` (the whole row; was the file name); `restoreCountTake(db, row: CountTake): 'ok' | 'taken'` (inserts without `id`; `'taken'` when the slot already holds a take).
  - Voice actions: `delete` (`id` → `{ deleted: id }`; the file stays on disk while held) and `restore` (`id` → `{ ok: true }` | `fail(409, { message: 'A newer take holds that slot now.' })` | `fail(410, { message: 'Too late to undo.' })`).

- [ ] **Step 1: Write the failing tests.**

  `back.spec.ts`:
  ```ts
  expect(voiceBack(null)).toEqual({ href: '/settings', label: 'Back to Settings' });
  expect(voiceBack('/salsa/player?song=3')).toEqual({ href: '/salsa/player?song=3', label: 'Back to Practice' });
  expect(voiceBack('/bachata/player')).toEqual({ href: '/bachata/player', label: 'Back to Practice' });
  for (const bad of ['https://evil.example/salsa/player', '//evil.example/salsa/player', '/salsa/figures', '/salsa/playerx', '%zz', ''])
    expect(voiceBack(bad).label).toBe('Back to Settings');
  const href = myCountHref('/salsa/player?song=3&routine=2', 'son');
  const u = new URL(href, 'http://x');
  expect(u.pathname).toBe('/voice');
  expect(voiceBack(u.searchParams.get('from')).href).toBe('/salsa/player?song=3&routine=2');
  expect(u.searchParams.get('pattern')).toBe('son');
  expect(myCountHref()).toBe('/voice');
  ```
  `grid.spec.ts` adds:
  ```ts
  expect(tempoMeta({ state: 'done' }, 'salsa')).toEqual({ text: 'Recorded', tone: 'done' });
  expect(tempoMeta({ state: 'half', half: 'a' }, 'salsa')).toEqual({ text: 'Half recorded · counts 1 2 3', tone: 'status' });
  expect(tempoMeta({ state: 'half', half: 'b' }, 'son')).toEqual({ text: 'Half recorded · counts 6 7 8', tone: 'status' });
  expect(tempoMeta({ state: 'none' }, 'all')).toEqual({ text: 'Not recorded', tone: 'muted' });
  // takes: salsa 120, 130, 140 with both halves, salsa 164 phrase a only, son 152 both:
  expect(recordedLabel(takes, 'salsa')).toBe('Tempos · 3 of 7 recorded');
  expect(takeRows([k('salsa',130,'a',3), k('salsa',120,'b',2), k('salsa',120,'a',1), k('son',120,'a',4)], 'salsa')).toEqual([
    { id: 1, title: '120 BPM · counts 1 2 3', meta: '1 2 3 · 5 6 7 · phrase A', deleteLabel: 'Delete 120 BPM phrase A', deleted: '120 BPM · counts 1 2 3 deleted' },
    { id: 2, title: '120 BPM · counts 5 6 7', meta: '1 2 3 · 5 6 7 · phrase B', deleteLabel: 'Delete 120 BPM phrase B', deleted: '120 BPM · counts 5 6 7 deleted' },
    { id: 3, /* 130 BPM · counts 1 2 3 … */ }
  ]);
  expect(keptMessage(152, ['a', 'b'], 'salsa')).toBe('Kept both halves for 152 BPM');
  expect(keptMessage(152, ['b'], 'salsa')).toBe('Kept counts 5 6 7 for 152 BPM');
  ```
  `voice-forms.spec.ts` (mock `getDb` and `$lib/server/files`' `countDir` to a `mkdtemp` dir; write a dummy `.wav` per take; `vi.useFakeTimers()` where noted):
  - `delete` → the row is gone, the file still exists; `restore` → one row for that slot again (same file); after `delete` and 60 s → the file is unlinked and `restore` is `fail(410)` "Too late to undo.".
  - Review Focus 2: `delete` 120/a, then `putCountTake` a new 120/a, then `restore` → `fail(409)` "A newer take holds that slot now.", the new take remains, the old file is gone at once.
  - `delete` an unknown id → `fail(404)` "That take is already gone." (as today).
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/voice src/lib/server/countTakes.spec.ts src/routes/voice` — Expected: FAIL.
- [ ] **Step 3: Implement the server and pure parts.** `voiceBack` decodes nothing itself (the caller passes `searchParams.get`); it accepts only `^/(salsa|bachata)/player(\?.*)?$` built from `DANCE_SLUGS`, with no `//` and no `\`. In `+page.server.ts` a module-level `const held = new Hold<CountTake>(UNDO_MS, (row) => unlink(join(countDir(), row.file)).catch(() => {}))` keyed `take:${id}`; `restore` that gets `'taken'` unlinks the file at once. Keep the "a failed unlink must not fail the request" reasoning; add that the file outlives the row for one minute so Undo has something to point at, and a restart leaves it behind as unreferenced disk (as a failed unlink always could).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: The list screen** (stage `grid`). `<Screen title="My count">`; `left` = `BandButton icon="back"` with `voiceBack(page.url.searchParams.get('from'))`; `extra` = `<Segmented onBand name="pattern" label="Count pattern" items={PHRASE_PATTERNS.map(p => ({ value: p, label: COUNT_PATTERN_LABEL[p] }))} bind:value={pattern} />`, `pattern` seeded from `?pattern=` when it is a `PhrasePattern`, else `'salsa'`. Body: the intro (15 px `text-ink-2`, `mx-1`); errors (Task 5); `SECTION_LABEL` `recordedLabel(...)` (6 px above); a `GROUP` `aria-label="Tempos"` of one row per `TEMPO_LADDER` tempo: title `{bpm} BPM` 16/700 `tabular-nums`, meta `tempoMeta` (13 px; `done` → `font-bold text-done`, `status` → `font-bold text-status`, `muted` → `text-muted`), trailing `button('secondary', 'sm')` + `mic` 18 "Record" (`aria-label="Record {bpm} BPM"`) when none, else `button('tertiary', 'sm')` "Redo" (`aria-label="Redo {bpm} BPM"`); both go to stage `arming` for that tempo. Then, when `takeRows` is not empty, "Recorded takes" (14 px above) and a `GROUP` of the rows with a trash `iconButton('bare').replace('text-ink', 'text-danger')` (`aria-label={deleteLabel}`): `act('delete', { id })` → toast `{ message: deleted, action: 'Undo' }`, Undo → `act('restore', { id })`; a refusal's message in the toast without action. Toast at `bottom="calc(1rem + env(safe-area-inset-bottom))"`. Delete the old header, the stacked per-pattern lists and the "Everything recorded" list. `<title>My count · Salsa</title>` stays.
- [ ] **Step 6: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 7: Look.** Insert takes into the dev DB with a one-off script (`$S/tools/system-takes.py`, sqlite3 on `.data/` with dummy wav files in `.data/count/`: salsa 120/130/140 both halves, 164 phrase a), then `FULL=1 $S/tools/page.sh $S/shots/system-4 /voice '/voice?pattern=son' '/voice?from=%2Fsalsa%2Fplayer'`: the board's "My count" (salsa, `s-system-0.png`), the son pattern lit on the band, "Back to Practice" on the third (check its `aria-label`). Delete a take (toast with Undo above the bottom edge), Undo (row back). Remove the inserted rows and files afterwards.
- [ ] **Step 8: Commit** `feat(voice): My count's list in the new look, back to where it was opened, Undo for a take`.

### Task 5: My count — get ready, recording, pick the bars

**Files:**
- Create: `src/lib/voice/recording.ts`
- Modify: `src/routes/voice/+page.svelte`, `src/lib/components/ui/UnsavedDialog.svelte`
- Test: `src/lib/voice/recording.spec.ts`

**Interfaces:**
- Consumes: `keptMessage`, `tempoState` (Tasks 2, 4); `leaveOrAsk` from `$lib/unsaved/guard.svelte`; `BottomBar`, `Banner`, `CHIP`, `Spinner`.
- Produces (`recording.ts`):
  - `type Dot = 'said' | 'current' | 'silent' | 'next'`;
  - `recordingView(pattern: PhrasePattern, bars: number, beat: { bar: number; count: number } | null): { heading: string; say: string | null; line: string | null; dots: Dot[]; barsDone: number; barFraction: number }`;
  - `silentLine(pattern: PhrasePattern): string`;
  - `voiceError(e: unknown): { title: string; body: string }`.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  expect(recordingView('salsa', 4, null)).toEqual({ heading: 'Get ready', say: null, line: null,
    dots: ['next','next','next','silent','next','next','next','silent'], barsDone: 0, barFraction: 0 });
  expect(recordingView('salsa', 4, { bar: -1, count: 3 })).toMatchObject({ heading: 'Count-in', say: null,
    line: 'Start counting on the next 1', dots: ['next','next','current','silent','next','next','next','silent'], barsDone: 0 });
  expect(recordingView('salsa', 4, { bar: 1, count: 5 })).toEqual({ heading: 'Bar 2 of 4', say: '5', line: null,
    dots: ['said','said','said','silent','current','next','next','silent'], barsDone: 1, barFraction: 5 / 8 });
  expect(recordingView('salsa', 4, { bar: 0, count: 4 })).toMatchObject({ say: null, line: 'Silent on 4' });
  expect(recordingView('son', 4, { bar: 3, count: 1 })).toMatchObject({ heading: 'Bar 4 of 4', say: null, line: 'Silent on 1' });
  expect(recordingView('all', 4, { bar: 0, count: 8 }).dots).toEqual(['said','said','said','said','said','said','said','current']);
  expect(silentLine('salsa')).toBe('Count evenly and leave beats 4 and 8 silent.');
  expect(silentLine('son')).toBe('Count evenly and leave beats 1 and 5 silent.');
  expect(silentLine('all')).toBe('Count evenly, every beat.');
  expect(voiceError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toEqual({
    title: 'The microphone was refused', body: 'Allow it for this app in the phone’s settings, then try again.' });
  expect(voiceError(new Error('Boom'))).toEqual({ title: 'Recording failed', body: 'Boom' });
  ```
  Plus `NOTHING_CAPTURED = { title: 'Nothing usable was captured', body: 'Check the microphone permission.' }` exported and used by the page.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/voice` — Expected: FAIL.
- [ ] **Step 3: Implement** `recording.ts` (silent counts are the 1–8 not in `COUNT_POSITIONS[pattern]`; a silent beat is `'silent'` even before it passes, `'current'` wins). In the page, `where` becomes `beat` state set from `onBeat`; `error` becomes `{ title; body } | null`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: The stages.** All stages are a `Screen` whose `left` is `BandButton icon="back" label="Back to My count"`; the back stays an in-page stage change, as today (no history entry).
  - **Errors** on the list: `Banner kind="error" title body` above the tempo label (mic refused, nothing captured, recording failed).
  - **arming:** `title="{bpm} BPM"`, `subtitle="Count {COUNT_PATTERN_LABEL[pattern]}"`, back → `grid`. `Banner kind="warning" title="Put headphones on first"` with the body (keep the comment on why it is not a suggestion); "How it goes" (14 px above); a card (`bg-surface rounded-[22px] py-1`) of three steps — a 28 px `bg-accent-soft text-accent-text` 14/800 number disc, then 15 px `text-ink`: "One bar of clicks to find the tempo.", "Count <strong>{label}</strong> out loud for {BARS} bars.", `silentLine(pattern)`. `BottomBar`: `button('primary', 'lg', true)` + `mic` "Start" → `record()`. The old Back button goes (the band's back replaces it).
  - **recording:** `title="Recording"`, `subtitle="{label} at {bpm} BPM"`; back → `gen++; controller?.abort(); stage = 'grid'` (nothing chosen yet is lost on purpose — say so in a comment). A card (`bg-surface rounded-[22px] px-[18px] pt-[22px] pb-6`, centred, gap 18): the pill "Recording" (h 30, `bg-danger-soft text-danger` 13/800, an 8 px `bg-danger` dot); `<p role="status">` with `heading` in `font-display text-[40px] font-extrabold` and under it 15/600 `text-muted` "Say <strong class="text-ink">{say}</strong> now" or `line`; the eight dots (34 px, 9 px apart, `aria-hidden`; `current` `bg-accent text-on-accent` + 6 px halo `accent/20`, `said` `bg-accent-soft text-accent-text`, `silent` transparent `text-muted` with a 2 px `hairline` inset ring, `next` `bg-surface text-ink` with a 1 px `field-line` inset ring); the four-part bar (`role="progressbar" aria-label="Bars counted" aria-valuemax={BARS} aria-valuenow={barsDone}`, 6 px tall, 6 px gaps, done `bg-accent`, the current one `bg-hairline` with an `bg-accent` fill at `barFraction`). Under the card, 13 px `text-muted` `px-4 pt-1.5`: "Stop keeps the whole bars you counted. Redo throws them away and starts the count-in again." `BottomBar`: two half-width `lg` buttons — `secondary` + `refresh` "Redo" → `redo()`, `primary` + `stop` "Stop" → `stopRecording()`.
  - **choosing:** `title="Pick the bars"`, `subtitle="{label} at {bpm} BPM"`; back → `leaveOrAsk(null, () => { capture = null; stage = 'grid'; })` (the board's Unsaved dialog). The intro paragraph; "First half" / "Second half" labels (6 px above) each over a card (`bg-surface rounded-[22px] p-4`, gap 10): "Counts {phraseCounts(...).join(' ')}" 16/700, then either "Nothing usable in this half." (14 px `text-muted`) or a `role="radiogroup" aria-label="Bar for counts {…}"` of `CHIP` radios "Bar {i+1}" and `button('secondary', 'sm')` + `play` "Listen to bar {chosen+1}". `BottomBar`, stacked, gap 8: `button('primary', 'lg', true)` + `check` "Keep these" (saving: `Spinner` + "Saving…", `aria-busy`), disabled as today; `button('tertiary', 'md', true)` + `refresh` "Record again". The old Back button goes. A failed keep shows `Banner kind="error" title="Could not save the takes"` with the message at the top of this stage.
  - **after keep:** back on the list with toast `{ message: keptMessage(bpm, keptHalves, pattern), icon: 'check', tone: 'done' }`, and the "Recorded takes" group scrolled into view (`scrollIntoView({ block: 'end' })`, instant under reduced motion).
- [ ] **Step 6: UnsavedDialog to the board.** Behaviour, answers and wiring unchanged. Add the board's 40 px leading icon square (radius 12) above each title: `edit` on `bg-accent-soft text-accent-text` (asking), `check` on `bg-done-soft text-done` (saved), `warning` on `bg-danger-soft text-danger` (failed); the saved title is "Saved" in `text-ink` (the icon carries the tick); the failed state's body line is `{labels}.` before the messages, and each message box gets a `warning` 18 icon.
- [ ] **Step 7: Run** `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** `$S/tools/system-voice.py` (from `sheet.py`; launch chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` and `ctx.grant_permissions(['microphone'])`): tap Record on 152 → arming; Start → shoot mid-recording (≈ 3 s in); Stop after 2 bars → choosing; tap the band's back → Unsaved dialog; Stay; Keep these → the list with the toast. A second context without the fake-ui flag and without the permission → Start → the refused banner. Compare with "My count · mic refused", "· get ready", "· recording", "· pick the bars", "· kept" (`s-system-0.png`) and "Unsaved changes", "Unsaved · saved", "Unsaved · not saved" (`s-system-1.png`; for not saved, block `**/api/count-takes` in the script), light and dark. Remove the takes the run saved.
- [ ] **Step 9: Commit** `feat(voice): recording stages in the new look — count dots, bar progress, pick the bars`.

### Task 6: Sign in, pairing, the share target — and a band on every page

**Files:**
- Create: `src/lib/components/system/StatusBlock.svelte`
- Modify: `src/lib/dances/dances.ts` (`danceInPath`), `src/routes/+layout.svelte` (use it), `src/routes/login/+page.server.ts`, `src/routes/login/+page.svelte`, `src/routes/device/pair/+page.svelte`, `src/routes/[dance]/share/+page.svelte`, `src/lib/components/shell/NavProgress.svelte` (comment only)
- Test: `src/lib/dances/dances.spec.ts`, `src/lib/nav/bands.spec.ts`

**Interfaces:**
- Consumes: `LeadTile` (Task 3); `Screen`, `BottomBar`, `Banner`, `EmptyState`, `Spinner`, `FIELD`, `LABEL`, `button`.
- Produces:
  - `danceInPath(path: string): DanceSlug | null` — the first segment when it is a dance (replaces the root layout's local `danceOf`).
  - `<StatusBlock icon: IconName tone: 'accent' | 'warn' | 'danger' | 'done' title: string body: string code?: string actions?: Snippet />` — centred, `pt-10 px-5`, gap 10: an 80 px circle in `bg-<tone>-soft` (accent: `bg-accent-soft`) with a 36 px icon in the tone's ink (`text-accent-text`, `text-warn`, `text-danger`, `text-done`); `code` 12/800 `tracking-[0.08em] text-muted`; title `<h2>` `font-display` 22/800; body 15 px `text-muted` `max-w-[290px]`; actions in a full-width column, gap 8, 14 px above.
  - Login load also returns `dance: DanceSlug` (`danceInPath(next)` ?? the dance cookie ?? `DEFAULT_DANCE`).

- [ ] **Step 1: Write the failing tests.** `dances.spec.ts`: `danceInPath('/bachata/figures/2')` → `'bachata'`; `'/salsa'` → `'salsa'`; `'/settings'`, `'/'`, `'/salsax/a'` → `null`. `bands.spec.ts` — every page draws a band, so the cream NavProgress always has one under it:
  ```ts
  // Pages that draw no band of their own, each with its reason. Cleanup empties PENDING.
  const NO_BAND: Record<string, string> = { 'src/routes/dev/kit/+page.svelte': 'dev gallery' };
  const PENDING: Record<string, string> = {}; // a page an earlier area plan has not redrawn yet: 'path': 'plan name'
  it('gives every page a band', () => {
    for (const file of globSync('src/routes/**/+page.svelte')) {
      if (file in NO_BAND || file in PENDING) continue;
      expect(readFileSync(file, 'utf8'), file).toMatch(/<(Screen|ErrorScreen)\b/);
    }
  });
  ```
  (use `node:fs` `globSync` or a small recursive `readdirSync`; add any page whose band comes from a child component, e.g. Practice's stage, to `NO_BAND` with the component's name as the reason, after checking it really draws one.)
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/dances src/lib/nav/bands.spec.ts` — Expected: FAIL (`danceInPath` missing; login, pair and share have no `Screen`). Any other page it names: if its area plan has landed, that page is a bug to report, not to allowlist; if not, put it in `PENDING` with the plan's name.
- [ ] **Step 3: Sign in.** The page wraps itself in `<div data-dance={data.dance} style:display="contents">` (the shell's wrapper is off on `/login`). `<Screen title="Sign in" subtitle="Welcome back. Sign in to practise.">`, no band buttons. A form card (`bg-surface rounded-[22px] px-4 pt-5 pb-4 flex flex-col gap-4`) with Email and Password (`LABEL` + `FIELD`, same names, types and `autocomplete` as today), `{#if form?.message}<Banner kind="error" title={form.message} />` above the button, and `button('primary', 'lg', true)` "Sign in" — while submitting: `Spinner` + "Signing in…", `aria-busy`, and both fields `disabled` (safe: `enhance` builds the FormData before the callback runs — say so). Under the card, 13 px `text-muted` centred, 6 px above: "Registration is closed." `<title>Sign in</title>`. `+page.server.ts` load adds `dance`.
- [ ] **Step 4: Pairing.** Wrap in `data-dance` = `?dance` when `isDanceSlug`, else `data.lastDance`. `<Screen title="Pair the app">` (no back: the app opened it). Ready: `StatusBlock icon="phone" tone="accent" title="Pair this phone" body=…`; `BottomBar` with the `use:enhance` form and `button('primary', 'lg', true)` + `link` "Pair this phone" (busy: `Spinner`, `aria-busy`). Paired (`form?.link`): `StatusBlock icon="check" tone="done" title="Paired" body="Opening the app now. If it does not open by itself, tap the button."`; `BottomBar` with the app-link `<a>` styled `button('primary', 'lg', true)` + `external` "Open the app" (keep the eslint comments and the `$effect` that jumps). `<title>Pair the app</title>`.
- [ ] **Step 5: Share target.** `<Screen title="Add to a lesson" subtitle="Compressed and uploaded in the background">`, no back. Lessons: `SECTION_LABEL` "Recent lessons", `<ul class={GROUP} aria-label="Lessons">`, each row the existing `uploadLink(...)` `<a>` (min-h 64, gap 12, `pl-4 pr-3.5`): `LeadTile icon="lessons"`, title 16/700 (truncate), `dateLabel(lessonDay)` 13 `text-muted`, then `chevron-right` 20 `text-chevron` — or, on the tapped row, `Spinner size={22} label="Opening the app"` and the row `bg-ink/[0.06]`. `tapped` is set on click (no `preventDefault`) and cleared when the page becomes visible again (`visibilitychange`) or after 10 s. None: `EmptyState icon="lessons" title="No lessons yet" body="Make one in Lessons first, then share the video again."`. `<title>Add to a lesson</title>`.
- [ ] **Step 6: NavProgress.** No code change: its comment now says every page draws a band (pinned by `bands.spec.ts`), so cream always lands on the band or the slim band. Root layout: replace the local `danceOf` with `danceInPath`.
- [ ] **Step 7: Run** `timeout 600 nix develop -c npx vitest run src/lib/dances src/lib/nav/bands.spec.ts` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 8: Look.** Create `$S/tools/nocookies.json` (`{"cookies": []}`). `STATE=$S/tools/nocookies.json $S/tools/page.sh $S/shots/system-6 /login '/login?next=%2Fbachata'`; then `$S/tools/system-signin.py` (signed out): wrong password (banner), and a submit with the server delayed (`page.route('**/login', …)` holding 2 s) for "Signing in…" and the progress bar on the band. Signed in: `$S/tools/page.sh $S/shots/system-6 '/device/pair?dance=salsa' '/salsa/share?key=00000000-0000-4000-8000-000000000000' '/bachata/share?key=00000000-0000-4000-8000-000000000000'` and, in the script, tap Pair this phone (the paired state; the app link fails harmlessly in Chromium) and a share row (spinner). Compare with "Sign in" ×4 (`s-system-1.png`), "Pair the app" ×2 (`s-system-1.png`), "Add to a lesson" ×2 (`s-system-2.png`), light and dark. Remove the device the pairing created (Settings → Remove).
- [ ] **Step 9: Commit** `feat(system): sign in, pairing and the share target on a band`.

### Task 7: Error pages and offline

**Files:**
- Create: `src/lib/nav/error-view.ts`, `src/lib/components/system/ErrorScreen.svelte`, `src/routes/+error.svelte`, `src/hooks.client.ts` (only if needed, see Step 3)
- Modify: `src/routes/+layout.svelte`
- Test: `src/lib/nav/error-view.spec.ts`

**Interfaces:**
- Consumes: `StatusBlock` (Task 6), `danceInPath` (Task 6), `tabFor`, `TABS`.
- Produces:
  - `interface ErrorView { title: string; icon: IconName; tone: 'accent' | 'warn' | 'danger'; heading: string; body: string; code: string | null; retry: boolean; today: boolean }`
  - `errorView(status: number, message: string | undefined, offline: boolean): ErrorView`
  - `errorBack(path: string, dance: DanceSlug): { href: string; label: string }`
  - `<ErrorScreen view: ErrorView back: { label: string; href?: string; onclick?: () => void } todayHref: string onretry?: () => void />` — a `Screen` with `title={view.title}`, `left` = the back `BandButton`, and a `StatusBlock` whose actions are: retry → `button('primary', 'md', true)` + `refresh` "Try again"; `today` → "Go to Today" as an `<a>` (`calendar` icon), primary when there is no retry, else `button('tertiary', 'md', true)`.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  expect(errorView(404, 'Not Found', false)).toEqual({ title: 'Not found', icon: 'search', tone: 'accent', heading: 'Nothing here',
    body: 'This page does not exist, or what it showed was deleted.', code: 'ERROR 404', retry: false, today: true });
  expect(errorView(404, 'Nothing was shared', false).heading).toBe('Nothing was shared');
  expect(errorView(500, 'Internal Error', false)).toEqual({ title: 'Error', icon: 'warning', tone: 'danger', heading: 'Something went wrong',
    body: 'The server could not open this page. Try again in a moment.', code: 'ERROR 500', retry: true, today: true });
  expect(errorView(503, undefined, false).code).toBe('ERROR 503');
  expect(errorView(500, 'Internal Error', true)).toEqual({ title: 'Offline', icon: 'refresh', tone: 'warn', heading: 'You’re offline',
    body: 'This page needs the server. Check the connection and try again; nothing you saved is lost.', code: null, retry: true, today: false });
  expect(errorView(400, 'Unknown take.', false)).toMatchObject({ title: 'Error', heading: 'Unknown take.', code: 'ERROR 400', retry: false, today: true });
  expect(errorBack('/salsa/figures/999', 'salsa')).toEqual({ href: '/salsa/figures', label: 'Back to Moves' });
  expect(errorBack('/bachata/lessons/4', 'bachata')).toEqual({ href: '/bachata/lessons', label: 'Back to Lessons' });
  expect(errorBack('/settings', 'salsa')).toEqual({ href: '/salsa', label: 'Back to Today' });
  ```
  Other 4xx: `body` "Go back and try again.", icon `warning`, tone `danger`.
- [ ] **Step 2: Run** `timeout 600 nix develop -c npx vitest run src/lib/nav/error-view.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `+error.svelte`: `dance = danceInPath(page.url.pathname) ?? page.data.lastDance`; `<ErrorScreen view={errorView(page.status, page.error?.message, browser && !navigator.onLine)} back={errorBack(page.url.pathname, dance)} todayHref={`/${dance}`} onretry={() => goto(page.url, { invalidateAll: true, replaceState: true })} />`. **Offline:** SvelteKit cannot show `+error.svelte` for a client navigation that cannot reach the server — the root layout has a server load, so it falls back to a full page load and the browser's own error page. So the root layout catches it before it starts: in `beforeNavigate`, when `to?.route.id` is set, `!willUnload`, the target is same-origin and `!navigator.onLine`, `cancel()` and set `offline = to.url`; render `ErrorScreen` with `errorView(0, undefined, true)` as a fixed `inset-0 z-40 bg-ground overflow-y-auto` layer over the page (over, not instead of it, so the page keeps whatever was typed); its back is `{ label: errorBack(page.url.pathname, navDance.slug).label, onclick: () => (offline = null) }`; Try again → `const url = offline; offline = null; goto(url)`; `afterNavigate` clears it. Register this `beforeNavigate` after `guardNavigation()` and comment the order. `hooks.client.ts` is not needed — create it only if `npm run check` shows a type gap.
- [ ] **Step 4: Run** `timeout 600 nix develop -c npx vitest run src/lib/nav` and `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Look.** `$S/tools/page.sh $S/shots/system-7 /salsa/figures/999999 '/salsa/share?key=nope'`; `$S/tools/system-errors.py`: a 500 (`page.route('**/salsa/songs/__data.json', lambda r: r.fulfill(status=500, content_type='application/json', body='{"type":"error","error":{"message":"Internal Error"},"status":500}'))` then click the Music tab), and offline (`/salsa/lessons`, `ctx.set_offline(True)`, tap a lesson → the Offline layer with "Back to Lessons"; back dismisses it; `set_offline(False)`, Try again opens the lesson). Compare with "Not found", "Offline", "Server error" in `s-system-2.png`, light and dark.
- [ ] **Step 6: Commit** `feat(system): designed 404, offline and server-error pages`.

### Task 8: The Android navigation-bar strip, and the docs

**Files:**
- Create: `android/app/src/main/kotlin/eu/anotherroot/salsa/Bars.kt`, `android/app/src/test/kotlin/eu/anotherroot/salsa/BarsTest.kt`, `src/lib/app-bars.svelte.ts`
- Modify: `android/app/src/main/kotlin/eu/anotherroot/salsa/WebShell.kt`, `src/routes/+layout.svelte`, the figure page's variation switcher (the component that pins it on the tab-bar surface; `use:tabSurface`)
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-14-android-app-design.md`, `docs/superpowers/specs/2026-09-22-salsa-app-design.md`, `docs/superpowers/specs/2026-10-31-redesign-design.md`, `docs/superpowers/specs/2026-09-23-count-voice-design.md`

**Interfaces:**
- Produces:
  - Kotlin: `enum class Strip { TABS, PAGE }`; `fun stripFor(message: String?): Strip?` — `"tabs"` → `TABS`, `"page"` → `PAGE`, anything else → `null` (ignored). `WebShell` registers a WebMessageListener `SalsaBars` (same origin set and feature checks as `wakeLockBridge`) and on a strip recolours the bottom layer: `TABS` → `navBarColor`, `PAGE` → `pageColor`.
  - `src/lib/app-bars.svelte.ts`: `reportStrip(strip: 'tabs' | 'page'): void` — `(window as { SalsaBars?: { postMessage(m: string): void } }).SalsaBars?.postMessage(strip)`, a no-op in a browser; `tabSurface: Action` and `const pinned = $state({ count: 0 })` — a component pinned on the tab-bar surface registers itself while mounted.

- [ ] **Step 1: Write the failing test** `BarsTest.kt`: `stripFor("tabs") == Strip.TABS`, `stripFor("page") == Strip.PAGE`, `stripFor(null) == null`, `stripFor("TABS") == null`.
- [ ] **Step 2: Run** `timeout 900 nix develop .#android -c ./android/gradlew -p android test` — Expected: FAIL (unresolved `stripFor`).
- [ ] **Step 3: Implement.** Keep the `LayerDrawable` as a field; recolour layer 2 (`(background.getDrawable(2) as ColorDrawable).color = …`) on the main thread. Update the `navBarColor` KDoc: the tab bar's colour while the page shows tabs (or a bar on their surface), the page's otherwise, told by the page; without the WebMessageListener feature it stays `navBarColor` as before. Web: the root layout runs `$effect(() => reportStrip(tabs || pinned.count > 0 ? 'tabs' : 'page'))`; the variation switcher gets `use:tabSurface`.
- [ ] **Step 4: Run** `timeout 900 nix develop .#android -c ./android/gradlew -p android test assembleDebug` — Expected: BUILD SUCCESSFUL. Then `timeout 900 nix develop -c npm run check` — Expected: PASS.
- [ ] **Step 5: Docs.**
  - `CLAUDE.md` Layout: `src/lib/voice/` gains "grid.ts (tempo states, takes, the Settings summary), recording.ts (the count dots and bar progress), back.ts (where My count goes back to) — PURE"; add `src/lib/settings/view.ts` (PURE: the reminder rule, device lines); `src/lib/nav/` gains `error-view.ts` (the error pages' words and back) and `bands.spec.ts` (every page draws a band); `src/lib/server/undo-hold.ts` (what Undo needs, held 60 s in memory); `src/lib/components/system/`; `src/lib/app-bars.svelte.ts` (tells the Android shell the strip colour). Hard rules, "Archive, don't delete": a removed paired phone and a deleted voice take come back with Undo for a minute (`undo-hold.ts`); a take's file is unlinked when its hold expires.
  - Android spec: the bottom strip follows the page (`SalsaBars`), and why (pushed screens have no tab bar).
  - Main design spec, Settings section: Settings is pushed from Today, saves on change, shows this dance's default style only; My count shows one pattern at a time; `+error.svelte` and the offline layer.
  - Redesign spec, "Settings, My count, sign-in and system": one line — "Offline: a tap made while the phone reports no connection shows the Offline page over the current one; a server that is down while the phone is online still ends in the browser's own error page (SvelteKit reloads the page then)."
  - Count voice spec: deleting a take is undoable for a minute; My count's back returns to Practice when opened from there (`myCountHref`).
- [ ] **Step 6: Commit** `feat(android): the navigation-bar strip follows the page; docs for the system plan`.

---

## Calls made in this plan

- **Undo is held on the server, not snapshotted to the page.** A paired phone's row holds its token hash, which must not reach the page (CLAUDE.md: only the hash is stored, and only server-side); a take's row points at a file that must outlive the delete. Both are deleted at once and kept in an in-memory `Hold` for 60 s. Cost if wrong: a restart within that minute loses the Undo ("Too late to undo.") and can leave one unreferenced wav on disk — the same as a failed unlink today.
- **A restored phone or take gets a new id** (insert without the id): `device_tokens` and `count_takes` may reuse a freed id, and nothing refers to either id. Cost: none known.
- **Toast copy names what went:** "Salsa app removed · Undo", "120 BPM · counts 1 2 3 deleted · Undo" — the spec's "Deleted · Undo" is the pattern, as the Moves and Logging plans read it.
- **Settings knows its dance from the dance cookie** (Today links to `/settings` without one). Each dance's default style is set from that dance's Settings; the other dance's setting is untouched, not lost. Cost: on the web, someone who switches dance by URL and opens Settings sees the dance of their last dance page — which is the one they came from.
- **Turning the reminder on uses the time last shown, else 19:30** (the board's value); turning it off stores no time (as today: `null` is off), so a reload forgets the old time. Cost: one re-pick of the time after off/reload/on.
- **The Switch's off track is `muted`** (≥ 3:1 on surface, ground, sheet and raised in all four themes) instead of the kit's `#b4b4bc` / `#4a4a52` (≈ 2:1). It reads darker than the board. Cost: a look change on every switch in the app, for WCAG 1.4.11.
- **A new neutral token `inverse-done`** (`#5cc98f` light / `#1e7a4f` dark) for the toast's check, as the kit draws it; no hex in components otherwise.
- **My count shows one pattern at a time** (the band's Segmented), its tempos and its takes; the takes list is filtered to that pattern. It opens on `?pattern=` when given, else salsa's. Cost: takes of other patterns are one tap away instead of on the same page.
- **"<n> of 21 tempos in your own voice" counts whole tempos** (both halves), across the three patterns; a half-recorded tempo does not count, and 0 reads "0 of 21…" rather than an invented line.
- **My count's back goes to Practice only for `/<dance>/player…`** (`?from=`); anything else is Settings — no open redirect. Practice must link with `myCountHref` (plan 10).
- **The My count stages stay in-page** (no history entry): the band's back steps to the list, as the old Back buttons did; the system Back still leaves the page (asking if a take is unsaved). The band back from Pick the bars asks with the Unsaved dialog (the board draws it there); from Recording it discards without asking — nothing has been chosen yet.
- **Recording copy the board does not draw:** before the first click "Get ready"; during the count-in "Count-in" / "Start counting on the next 1"; on a silent beat "Silent on 4"; the third arming step follows the pattern ("…leave beats 1 and 5 silent." for son, "Count evenly, every beat." for 1–8); "Nothing usable was captured" / "Check the microphone permission."; a failed save "Could not save the takes".
- **Offline is caught before the navigation** (`navigator.onLine` false), because SvelteKit answers an unreachable server with a full page reload, not `+error.svelte`. A server that is down while the phone has a connection still shows the browser's error page — written into the spec. The Offline page is a layer over the current page so nothing typed is lost.
- **Error pages' back goes to the tab the failed URL belongs to** ("Back to Moves" for a missing figure; Today when no tab owns it). A 404 with a message of its own ("Nothing was shared") uses it as the heading; other 4xx show their message; 5xx never show the server's message.
- **The Android strip follows the page** through a `SalsaBars` WebMessageListener ("tabs" / "page") rather than staying the tab bar's colour. Cost: a native change that is built and unit-tested but, like the rest of the Android app, not yet tried on the phone; without the WebView feature it falls back to today's colour.
- **NavProgress stays cream;** the fix for band-less pages is that no page is band-less any more, pinned by `bands.spec.ts` (with `PENDING` for pages an unlanded plan still owes — Cleanup empties it).
- **Login takes its dance from `next`** (then the cookie), so the bachata app's sign-in is wine-coloured; pairing from `?dance`. The browser tab titles of Sign in, pairing and the share target drop the dance name.
- **Disabled fields while signing in** are safe because `enhance` builds the FormData before its callback runs.
- **The share row's spinner clears** when the page becomes visible again or after 10 s (the app link leaves the page open behind the app).
- **UnsavedDialog gets the board's leading icons** and "Saved" without the ✓ (the icon carries it); its behaviour is untouched.
- **`act()` is reused from `components/routines/act.ts`** for every save and Undo here, as the Moves plan does; moving it to `src/lib/` is Cleanup's call.
- **Paired phones stays hidden when there are none** (as today); the board only draws a list with one.
