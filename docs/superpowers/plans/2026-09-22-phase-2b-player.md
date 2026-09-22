# Phase 2b — the player: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player that speaks the count on the beat, ticks the clave, and calls
random figures over 5-6-7 — over a song or against a plain BPM — and offers to
log a set when the run ends.

**Architecture:** One pure module (`src/lib/scheduler/scheduler.ts`) turns a beat
grid plus a plan plus toggles plus a time window into a list of cues; one thin
impure file (`src/lib/scheduler/attach.ts`) owns the `AudioContext`, the decoded
clips, the 25 ms look-ahead loop, `speechSynthesis` and the wake lock. The count
plays from committed AAC clips scheduled on the audio clock; figure names go
through the browser's own voice.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind 4, Drizzle on SQLite,
Vitest, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-09-22-salsa-app-design.md` — section
"Songs & player (phase 2)". Task 1 updates that section to match the decisions
below before anything else is built.

## Global Constraints

Copied from `CLAUDE.md` and the spec. Every task's requirements include these.

- **Pure modules take their inputs as arguments.** No `Date.now()`, no DOM, no
  `AudioContext` inside `src/lib/scheduler/scheduler.ts`. Randomness arrives as
  an injected `rand: () => number`.
- **Every instant in the database is an integer of epoch milliseconds.** Song
  times inside the scheduler are seconds (floats) — they are offsets, not
  instants, and never reach the database.
- **Archive, don't delete.** Sets and recordings are the only hard deletes.
- **Data functions take `db` as their first argument.** Routes pass `getDb()`.
- **Nothing under `$lib/server` is imported by a component.** Shared row shapes
  live in `src/lib/types.ts`, enums in `src/lib/labels.ts`.
- **Deny-by-default auth.** `/player` is private automatically; do NOT add it to
  `PUBLIC_PATHS`. `static/clips/*` is served by the static handler and needs no
  auth entry.
- **Dates on screen are built by hand** (`src/lib/format.ts`), never
  `toLocaleDateString`.
- **Svelte 5 runes** (`$props`, `$state`, `$derived`, `$effect`), never Svelte 4
  syntax. Tailwind 4, phone-first, tap targets ≥ 44 px, checked at 375 px.
- **`npm run check`** (prettier, eslint, svelte-check, build, vitest) must pass
  before any commit is considered done.
- **Never judge anything against `vite dev` alone** where production behaviour
  differs; `npm run check` runs the real build.

---

## Task 1: Schema, labels and the spec

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/labels.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/server/exercises.ts`
- Modify: `src/lib/server/figures.ts`
- Modify: `src/lib/server/songs.ts`
- Create: `drizzle/0002_*.sql` (generated)
- Modify: `docs/superpowers/specs/2026-09-22-salsa-app-design.md`
- Modify: `CLAUDE.md`
- Test: `src/lib/server/data.spec.ts`

**Interfaces:**
- Produces: `exercises.songId`, `exercises.countBpm`, `sets.playerJson`,
  `figures.callText`; `CLIPS`, `Clip`, `CLAVE_PATTERNS`, `ClavePattern`,
  `CALL_EVERY`, `CallEvery` in `labels.ts`; `CallableFigure` in `types.ts`.

- [ ] **Step 1: Add the columns to the schema**

In `src/lib/server/db/schema.ts`, add to `figures`, after `callable`:

```ts
		/**
		 * How to SAY the name, when the browser's voice mangles the written one
		 * ("dile que no" read as English). Null means speak `name`.
		 */
		callText: text('call_text'),
```

Add to `exercises`, after `practiceMode`:

```ts
		/** Practice mode 'song': which song the player opens. */
		songId: integer('song_id').references(() => songs.id),
		/** Practice mode 'count': the BPM of the synthetic grid. */
		countBpm: integer('count_bpm'),
```

`songs` is declared below `exercises` in the file. A `references()` callback is
lazy, so the forward reference is fine — but move the `songs` table declaration
ABOVE the "Exercises & sets" section so a reader meets it first, keeping the
section comments with their tables.

Add to `sets`, after `note`:

```ts
		/**
		 * Phase 2b: what the player run looked like —
		 * `{speed, count, clave, callEvery, called:[figureId…]}`. Free-form on
		 * purpose; nothing queries inside it.
		 */
		playerJson: text('player_json'),
```

Add a check constraint to `exercises`, alongside the existing ones:

```ts
			check(
				'exercises_practice_ck',
				sql`(${t.practiceMode} = 'song') <= (${t.songId} is not null)
				    and (${t.practiceMode} = 'count') <= (${t.countBpm} is not null)`
			),
```

- [ ] **Step 2: Generate and inspect the migration**

```bash
npm run db:generate
```

Read the generated file. SQLite cannot add a CHECK constraint to an existing
table, so drizzle-kit will rebuild `exercises` (create-new, copy, drop, rename).
Confirm the generated SQL copies every existing column, and that the copy
happens inside the migration's transaction. If drizzle-kit instead emits a bare
`ALTER TABLE exercises ADD CONSTRAINT`, which SQLite rejects, drop the
`exercises_practice_ck` check from the schema and enforce the pairing in
`updateExercise` instead — note the swap in the task report.

- [ ] **Step 3: Add the enums**

In `src/lib/labels.ts`:

```ts
/** The clips shipped in `static/clips/`. See `scripts/make-clips.sh`. */
export const CLIPS = ['uno', 'dos', 'tres', 'cinco', 'seis', 'siete', 'clave'] as const;
export type Clip = (typeof CLIPS)[number];

/** Which clave the player ticks. Positions live in `src/lib/scheduler/`. */
export const CLAVE_PATTERNS = ['3-2', '2-3'] as const;
export type ClavePattern = (typeof CLAVE_PATTERNS)[number];

/** How many 8-counts between figure calls. */
export const CALL_EVERY = [1, 2, 4] as const;
export type CallEvery = (typeof CALL_EVERY)[number];

export const PRACTICE_LABEL: Record<PracticeMode, string> = {
	song: 'With a song',
	count: 'Count only',
	none: 'Just log it'
};

/** Playback speeds the player offers. 1 first: the default is full speed. */
export const SPEEDS = [1, 0.9, 0.8, 0.7] as const;
export type Speed = (typeof SPEEDS)[number];
```

- [ ] **Step 4: Widen the data layer**

`src/lib/types.ts` — add `practiceMode`, `songId`, `countBpm` to `ExerciseItem`,
and add:

```ts
/** A figure the player may call, as the setup screen lists it. */
export interface CallableFigure {
	id: number;
	name: string;
	/** What the voice should say — `callText` if set, else `name`. */
	say: string;
	partner: Partner;
	style: Style;
}
```

`src/lib/server/exercises.ts`:
- `listExercises` selects the three new exercise columns.
- `ExerciseInput` gains `practiceMode: PracticeMode`, `songId: number | null`,
  `countBpm: number | null`; `updateExercise` writes them, and **normalises**:
  mode `'song'` clears `countBpm`, mode `'count'` clears `songId`, mode `'none'`
  clears both. That normalisation is what keeps the check constraint satisfiable
  from any form submission.
- `SetInput` gains `playerJson: string | null`; `logSet` writes it. Every
  existing caller must pass `playerJson: null` — update
  `src/routes/+page.server.ts`'s `log` action accordingly.

`src/lib/server/figures.ts`: `FigureInput` gains `callable: boolean` and
`callText: string | null`; create and update write them. Add:

```ts
/** Figures the player may call, alphabetical. Archived and non-callable excluded. */
export function listCallableFigures(db: Db): CallableFigure[] {
	return db
		.select({
			id: figures.id,
			name: figures.name,
			callText: figures.callText,
			partner: figures.partner,
			style: figures.style
		})
		.from(figures)
		.where(and(isNull(figures.archivedAt), eq(figures.callable, true)))
		.orderBy(figures.name)
		.all()
		.map(({ callText, ...f }) => ({ ...f, say: callText ?? f.name }));
}
```

`src/lib/server/songs.ts`: add

```ts
/** Ready, unarchived songs, for the practice-mode song picker. */
export function listReadySongs(db: Db): { id: number; title: string }[] {
	return db
		.select({ id: songs.id, title: songs.title })
		.from(songs)
		.where(and(isNull(songs.archivedAt), eq(songs.status, 'ready')))
		.orderBy(songs.title)
		.all();
}
```

- [ ] **Step 5: Test the new data-layer behaviour**

Add to `src/lib/server/data.spec.ts`, following the file's existing setup:

```ts
it('lists only callable, unarchived figures, and says callText when set', () => {
	const a = createFigure(db, { name: 'Enchufla', partner: 'partner', style: 'salsa', notes: null, callable: true, callText: null });
	createFigure(db, { name: 'Hidden', partner: 'solo', style: 'salsa', notes: null, callable: false, callText: null });
	const c = createFigure(db, { name: 'Dile que no', partner: 'partner', style: 'salsa', notes: null, callable: true, callText: 'dee-lay kay no' });
	archiveFigure(db, a.figure.id, Date.now());

	const out = listCallableFigures(db);
	expect(out.map((f) => f.name)).toEqual(['Dile que no']);
	expect(out[0].say).toBe('dee-lay kay no');
	expect(c.figure.id).toBe(out[0].id);
});

it('clears the unused practice column when the mode changes', () => {
	const e = createCustomExercise(db, { name: 'Drill', everyDays: 1, notes: null });
	updateExercise(db, e.id, { ...base, practiceMode: 'count', songId: null, countBpm: 180 });
	expect(updateExercise(db, e.id, { ...base, practiceMode: 'none', songId: null, countBpm: 180 })!.countBpm).toBeNull();
});

it('keeps a player run on its set', () => {
	const e = createCustomExercise(db, { name: 'Drill', everyDays: 1, notes: null });
	const s = logSet(db, { exerciseId: e.id, doneAt: 1, durationS: 300, reps: null, rating: null, note: null, playerJson: '{"speed":0.8}' });
	expect(JSON.parse(s.playerJson!).speed).toBe(0.8);
});
```

Adapt the exact argument shapes to whatever `createFigure` / `updateExercise`
currently take after Step 4 — read the file rather than trusting these literals.

- [ ] **Step 6: Update the spec and CLAUDE.md**

In the spec's "Songs & player (phase 2)" section, replace the **Voice clips**
paragraph with:

```markdown
**Voice:** the count plays from seven clips shipped with the app
(`static/clips/`: uno, dos, tres, cinco, seis, siete, clave), generated once by
`scripts/make-clips.sh` with Piper and committed. They are decoded into
`AudioBuffer`s and scheduled on the audio clock, so every number lands on its
beat. Figure NAMES are spoken by the browser (`speechSynthesis`): a name sounds
across a whole 3-beat window, so its timing jitter does not matter, and this
needs no worker job and no per-figure storage. `figures.call_text` overrides
what is said when the browser mispronounces a written name. Phase 3 may revisit
Piper clips if a device's voice proves unusable.
```

Update the architecture diagram: drop `piper TTS → call clips (phase 2b)` from
the home-worker box and drop `clips/` from the server's files line. Update the
data model block: `figures` loses `call_clip` and gains `call_text`; `exercises`
keeps `song_id` and `count_bpm`; `sets` keeps `player_json`.

In `CLAUDE.md`, add to the layout block and to the hard rules:

```
src/lib/scheduler/   PURE cues: grid + plan + toggles + window → what sounds when
```

```markdown
- **The player's timing is the audio clock's, not `setTimeout`'s.** Counts are
  decoded clips scheduled on an `AudioContext` with a 25 ms look-ahead;
  `src/lib/scheduler/scheduler.ts` decides WHAT sounds and WHEN in song time and
  never touches audio. Figure names go through `speechSynthesis`, which cannot be
  scheduled and does not need to be.
```

- [ ] **Step 7: Verify and commit**

```bash
npm run check
git add -A
git commit -m "player: practice mode, call text and player runs in the schema"
```

---

## Task 2: The voice clips

**Files:**
- Create: `scripts/make-clips.sh`
- Create: `static/clips/{uno,dos,tres,cinco,seis,siete,clave}.m4a`
- Modify: `flake.nix` (dev-shell only)

**Interfaces:**
- Produces: seven files at `/clips/<name>.m4a`, mono 48 kHz AAC, each well under
  50 KB, decodable by `decodeAudioData`.

- [ ] **Step 1: Write the generator**

`scripts/make-clips.sh`, executable:

```bash
#!/usr/bin/env bash
# Generate the player's voice clips. Run once; the OUTPUT is committed, so
# neither a build nor the running app ever needs Piper or a network.
#
#   ./scripts/make-clips.sh
#
# The count is Spanish because that is how the dance is counted. 4 and 8 are
# silent on purpose — the salsa pause — so they have no clip.
set -euo pipefail
cd "$(dirname "$0")/.."
out=static/clips
mkdir -p "$out"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# nixpkgs' piper-tts does NOT fetch voices itself (no --download-dir, and -m
# wants a real .onnx path), so the model is pulled straight from the Piper
# voices repo. Cached in .data/ so a re-run is instant; .data/ is gitignored.
voice_base=https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium
cache=.data/piper
mkdir -p "$cache"
for ext in onnx onnx.json; do
  [ -s "$cache/voice.$ext" ] || curl -fL --retry 3 -o "$cache/voice.$ext" "$voice_base.$ext"
done

# --length-scale 0.75: at the natural rate "cinco", "seis" and "siete" run
# ~0.57 s, which smears across the next beat at 180 BPM (a beat is 0.333 s).
# Measured: 0.75 brings every word to 0.40 s or under. --sentence-silence 0
# drops the trailing pause Piper adds after a sentence.
for word in uno dos tres cinco seis siete; do
  echo "$word" | nix run nixpkgs#piper-tts -- \
    -m "$cache/voice.onnx" -c "$cache/voice.onnx.json" \
    --length-scale 0.75 --sentence-silence 0 \
    -f "$work/$word.wav"
done

# The clave: a woodblock is a short, hard, high click. A 2.5 kHz sine cut to
# 45 ms with a steep exponential decay is close enough to sit in a salsa mix,
# and it costs no voice model.
nix run nixpkgs#ffmpeg -- -y -f lavfi \
  -i "sine=frequency=2500:duration=0.045" \
  -af "afade=t=out:st=0:d=0.045:curve=exp,volume=0.9" \
  "$work/clave.wav"

# One shape for every clip: mono 48 kHz AAC, loudness-normalised so the count
# carries over a song without a per-clip volume fudge. Silence comes off BOTH
# ends — leading silence would land the word late however well it was
# scheduled, and a trailing tail eats into the next beat.
for f in "$work"/*.wav; do
  name=$(basename "$f" .wav)
  nix run nixpkgs#ffmpeg -- -y -i "$f" \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.02,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ac 1 -ar 48000 -c:a aac -b:a 64k "$out/$name.m4a"
done

ls -l "$out"
```

- [ ] **Step 2: Run it and check the output**

```bash
./scripts/make-clips.sh
```

Expected: seven `.m4a` files. Verify each is non-trivial and small, and that the
words are actually short (a count clip longer than ~450 ms will run into the
next beat at fast tempi):

```bash
for f in static/clips/*.m4a; do
  printf '%s %s bytes %ss\n' "$f" "$(stat -c%s "$f")" \
    "$(nix run nixpkgs#ffmpeg -- -i "$f" -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1)"
done
```

Every file must be **under 50 KB** and **under 0.5 s**. If a word is longer,
re-run that word through Piper with `--length_scale 0.85` and re-normalise. If
Piper cannot fetch the voice (no network), stop and report BLOCKED rather than
substituting `espeak` — its output is not good enough to practise to.

- [ ] **Step 3: Listen to them**

Play `static/clips/uno.m4a` and `static/clips/clave.m4a`. The number must be
intelligible at a glance and the clave must read as a click, not a beep. This is
a human check; if you cannot play audio, say so in the report and move on.

- [ ] **Step 4: Note the dev-shell addition**

Add nothing to `buildInputs` — the script uses `nix run` so the dev shell stays
lean. Add a line to the `shellHook`'s printed hints:

```
            echo "  ./scripts/make-clips.sh   regenerate the player's voice clips"
```

- [ ] **Step 5: Commit**

Confirm `static/clips/` is not gitignored (`git check-ignore static/clips` must
print nothing), then:

```bash
git add scripts/make-clips.sh static/clips flake.nix
git commit -m "player: shipped Spanish count clips and a clave, with their generator"
```

---

## Task 3: `scheduler.ts` — the pure module (TDD)

**Files:**
- Create: `src/lib/scheduler/scheduler.ts`
- Test: `src/lib/scheduler/scheduler.spec.ts`

**Interfaces:**
- Consumes: `Clip`, `ClavePattern`, `CallEvery` from `$lib/labels` (Task 1).
- Produces: `Timeline`, `timeline()`, `timeAt()`, `Cue`, `Call`, `Toggles`,
  `PlanStep`, `cuesIn()`, `pickFigure()`, `extendPlan()`, `syntheticGrid()`,
  `LEAD_IN_8S`, `CLAVE_POSITIONS`, `COUNT_CLIP`.

**Write the tests first, run them, watch them fail, then implement.**

- [ ] **Step 1: Write the failing tests**

`src/lib/scheduler/scheduler.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	CLAVE_POSITIONS,
	LEAD_IN_8S,
	cuesIn,
	extendPlan,
	pickFigure,
	syntheticGrid,
	timeAt,
	timeline
} from './scheduler';

/** A clean grid: `bars` 8-counts at 120 BPM, so a beat every 0.5 s. */
const grid = (bars: number) => syntheticGrid(120, bars);
const t = (bars: number) => timeline(grid(bars));

const ALL = { count: true, clave: null, callEvery: null } as const;
const clips = (r: { cues: { at: number; clip: string }[] }) => r.cues.map((c) => c.clip);
const times = (r: { cues: { at: number }[] }) => r.cues.map((c) => c.at);

describe('syntheticGrid', () => {
	it('spaces beats by the BPM and counts them 1-8', () => {
		const g = syntheticGrid(120, 2);
		expect(g.beats).toHaveLength(16);
		expect(g.beats[1] - g.beats[0]).toBeCloseTo(0.5);
		expect(g.counts.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1]);
	});
});

describe('timeline', () => {
	it('numbers the 8-counts from the first "1"', () => {
		const tl = t(3);
		expect(tl.eights.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1]);
		expect(tl.starts).toEqual([0, 8, 16]);
	});

	it('gives beats before the first "1" the 8-count -1', () => {
		// counts starting mid-bar: 5 6 7 8 1 2 ...
		const tl = timeline({ beats: [0, 0.5, 1, 1.5, 2, 2.5], counts: [5, 6, 7, 8, 1, 2] });
		expect(tl.eights).toEqual([-1, -1, -1, -1, 0, 0]);
		expect(tl.starts).toEqual([4]);
	});
});

describe('timeAt', () => {
	it('returns the beat time for a whole count', () => {
		expect(timeAt(t(2), 1, 3)).toBeCloseTo(0.5 * 10); // 8-count 1, count 3 = beat 10
	});

	it('interpolates a fractional count between its beats', () => {
		expect(timeAt(t(1), 0, 2.5)).toBeCloseTo(0.75); // halfway between beats 1 and 2
	});

	it('returns null past the end of the grid', () => {
		expect(timeAt(t(1), 5, 1)).toBeNull();
	});
});

describe('cuesIn — the count', () => {
	it('speaks 1 2 3 5 6 7 and stays silent on 4 and 8', () => {
		const r = cuesIn(t(1), [], ALL, 0, 4);
		expect(clips(r)).toEqual(['uno', 'dos', 'tres', 'cinco', 'seis', 'siete']);
		expect(times(r)).toEqual([0, 0.5, 1, 2, 2.5, 3]);
	});

	it('returns only what falls inside the window', () => {
		expect(clips(cuesIn(t(2), [], ALL, 2, 3))).toEqual(['cinco', 'seis']);
	});

	it('says nothing when the count is switched off', () => {
		expect(cuesIn(t(1), [], { ...ALL, count: false }, 0, 4).cues).toEqual([]);
	});
});

describe('cuesIn — the clave', () => {
	it('places 3-2 on 1, the and of 2, 4, 6 and 7', () => {
		const r = cuesIn(t(1), [], { count: false, clave: '3-2', callEvery: null }, 0, 4);
		expect(times(r)).toEqual([0, 0.75, 1.5, 2.5, 3]);
		expect(new Set(clips(r))).toEqual(new Set(['clave']));
	});

	it('places 2-3 on 2, 3, 5, the and of 6, and 8', () => {
		const r = cuesIn(t(1), [], { count: false, clave: '2-3', callEvery: null }, 0, 4);
		expect(times(r)).toEqual([0.5, 1, 2, 2.75, 3.5]);
	});

	it('is the 3-2 pattern with its halves swapped', () => {
		const shifted = CLAVE_POSITIONS['3-2'].map((p) => ((p + 3) % 8) + 1).sort((a, b) => a - b);
		expect(shifted).toEqual(CLAVE_POSITIONS['2-3']);
	});
});

describe('cuesIn — calls', () => {
	const pool = [7];
	const plan = [{ eight: 2, figureId: 7 }];

	it('sounds a call on the 5 of the 8-count before the figure', () => {
		// 8-count 1 starts at beat 8 (4 s); its count 5 is beat 12 = 6 s.
		const r = cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 0, 12);
		expect(r.calls).toEqual([{ at: 6, eight: 2, figureId: 7 }]);
	});

	it('suppresses the spoken count on 5-6-7 under a call', () => {
		const r = cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 6, 8);
		expect(clips(r)).toEqual([]); // 5, 6, 7 of 8-count 1 are the call's window
	});

	it('still counts 1 2 3 in the bar carrying a call', () => {
		expect(clips(cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 4, 6))).toEqual([
			'uno',
			'dos',
			'tres'
		]);
	});

	it('leaves other 8-counts fully counted', () => {
		expect(clips(cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 2, 4))).toEqual([
			'cinco',
			'seis',
			'siete'
		]);
	});

	it('drops a call whose lead-in bar is off the end of the grid', () => {
		expect(cuesIn(t(1), [{ eight: 9, figureId: 7 }], { ...ALL, callEvery: 2 }, 0, 99).calls).toEqual(
			[]
		);
	});

	it('ignores the pool when calls are switched off', () => {
		expect(cuesIn(t(4), plan, ALL, 0, 12).calls).toEqual([]);
		expect(pool).toHaveLength(1);
	});
});

describe('pickFigure', () => {
	it('never returns the figure just called', () => {
		for (let i = 0; i < 10; i++) expect(pickFigure([1, 2, 3], 2, i / 10)).not.toBe(2);
	});

	it('repeats when the pool holds only that figure', () => {
		expect(pickFigure([1], 1, 0.9)).toBe(1);
	});

	it('returns null for an empty pool', () => {
		expect(pickFigure([], null, 0)).toBeNull();
	});

	it('spreads across the pool', () => {
		expect([0, 0.4, 0.9].map((r) => pickFigure([1, 2, 3], null, r))).toEqual([1, 2, 3]);
	});
});

describe('extendPlan', () => {
	const rand = (seq: number[]) => {
		let i = 0;
		return () => seq[i++ % seq.length];
	};

	it('starts after the lead-in and steps by the interval', () => {
		expect(extendPlan([], [1, 2], 2, 6, rand([0, 0.9, 0])).map((s) => s.eight)).toEqual([2, 4, 6]);
		expect(LEAD_IN_8S).toBe(2);
	});

	it('continues an existing plan without redeciding it', () => {
		const first = extendPlan([], [1, 2], 2, 2, rand([0]));
		const more = extendPlan(first, [1, 2], 2, 4, rand([0.9]));
		expect(more[0]).toEqual(first[0]);
		expect(more).toHaveLength(2);
	});

	it('never places the same figure twice running', () => {
		const steps = extendPlan([], [1, 2, 3], 1, 20, rand([0, 0, 0, 0.99, 0.5]));
		for (let i = 1; i < steps.length; i++) {
			expect(steps[i].figureId).not.toBe(steps[i - 1].figureId);
		}
	});

	it('returns the plan unchanged for an empty pool', () => {
		expect(extendPlan([], [], 2, 10, rand([0]))).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run src/lib/scheduler
```

Expected: every test fails to import `./scheduler`.

- [ ] **Step 3: Implement**

`src/lib/scheduler/scheduler.ts`:

```ts
/**
 * What should sound, and when, while the player runs — as pure functions.
 *
 * The scheduler answers one question: for song time in `[from, to)`, which
 * clips play at which song times, and which figures get called. It owns no
 * clock and no audio; `attach.ts` maps these song times onto the AudioContext
 * and actually makes noise. That split is what makes the hard parts — which
 * clip on which count, the count ducking under a call, the clave's off-beats,
 * no figure twice running — testable without a browser.
 *
 * All times here are SONG seconds: offsets into the music, never instants.
 */
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import type { CallEvery, ClavePattern, Clip } from '$lib/labels';

/** Which clip speaks each count. 4 and 8 are silent — the salsa pause. */
export const COUNT_CLIP: Record<number, Clip | null> = {
	1: 'uno',
	2: 'dos',
	3: 'tres',
	4: null,
	5: 'cinco',
	6: 'seis',
	7: 'siete',
	8: null
};

/**
 * Clave hits as positions in the 8-count: 1-based, fractional for an off-beat,
 * so 2.5 is the "and" of 2. The son clave spans two bars of four, which is
 * exactly one 8-count; 2-3 is 3-2 with its halves swapped.
 */
export const CLAVE_POSITIONS: Record<ClavePattern, number[]> = {
	'3-2': [1, 2.5, 4, 6, 7],
	'2-3': [2, 3, 5, 6.5, 8]
};

/** 8-counts of count-only before the first figure is called, so a run can settle. */
export const LEAD_IN_8S = 2;

export interface Timeline {
	beats: number[];
	counts: number[];
	/** The 8-count each beat belongs to. Beats before the first "1" get -1. */
	eights: number[];
	/** `starts[e]` is the beat index where 8-count `e` begins. */
	starts: number[];
}

/**
 * Index a grid for the lookups below. A new 8-count begins on every "1", which
 * is how a re-anchored count (the user tapping after a break) simply starts a
 * new 8-count rather than corrupting the ones before it.
 */
export function timeline(grid: { beats: number[]; counts: number[] }): Timeline {
	const eights = new Array<number>(grid.counts.length);
	const starts: number[] = [];
	let e = -1;
	for (let i = 0; i < grid.counts.length; i++) {
		if (grid.counts[i] === 1) starts[++e] = i;
		eights[i] = e;
	}
	return { beats: grid.beats, counts: grid.counts, eights, starts };
}

/** The beat carrying count `c` of 8-count `e`, or -1 if the bar is short there. */
function beatOfCount(t: Timeline, e: number, c: number): number {
	const s = t.starts[e];
	if (s === undefined) return -1;
	const i = s + c - 1;
	// A bar cut short by a re-anchor does not have all eight counts.
	return i < t.beats.length && t.eights[i] === e && t.counts[i] === c ? i : -1;
}

/**
 * Song time of a position in an 8-count — `timeAt(t, 3, 2.5)` is the "and" of
 * 2 in the fourth 8-count. Fractions interpolate between neighbouring beats,
 * which is right even when the tempo drifts, because the grid is real beats.
 */
export function timeAt(t: Timeline, eight: number, pos: number): number | null {
	const whole = Math.floor(pos);
	const frac = pos - whole;
	const i = beatOfCount(t, eight, whole);
	if (i < 0) return null;
	if (frac === 0) return t.beats[i];
	if (i + 1 >= t.beats.length) return null;
	return t.beats[i] + (t.beats[i + 1] - t.beats[i]) * frac;
}

export interface Cue {
	at: number;
	clip: Clip;
}

export interface Call {
	at: number;
	/** The 8-count the figure STARTS on; the call sounds in the one before. */
	eight: number;
	figureId: number;
}

export interface Toggles {
	count: boolean;
	clave: ClavePattern | null;
	callEvery: CallEvery | null;
}

/** A figure placed on an 8-count. Random drill generates these; phase 3's choreographies supply them. */
export interface PlanStep {
	eight: number;
	figureId: number;
}

/** The count a call starts on, in the 8-count before the figure. */
const CALL_POS = 5;

/**
 * Everything that should sound in `[from, to)`, sorted by time.
 *
 * A call is spoken over 5-6-7 of the preceding 8-count so the figure begins on
 * the next "1", and the spoken count gets out of its way for those three beats.
 * Suppression is decided from the whole plan, not just the window, so a count
 * near a window edge ducks the same way however the ticks happen to fall.
 */
export function cuesIn(
	t: Timeline,
	plan: PlanStep[],
	toggles: Toggles,
	from: number,
	to: number
): { cues: Cue[]; calls: Call[] } {
	const cues: Cue[] = [];
	const calls: Call[] = [];
	const talking = new Set<number>();

	if (toggles.callEvery !== null) {
		for (const step of plan) {
			const at = timeAt(t, step.eight - 1, CALL_POS);
			if (at === null) continue;
			talking.add(step.eight - 1);
			if (at >= from && at < to) calls.push({ at, eight: step.eight, figureId: step.figureId });
		}
	}

	// Start one beat BEFORE the window: a fractional clave position can fall
	// inside it while the beat it hangs off sits just outside. Binary-searching
	// the start also keeps a tick O(window) rather than O(song), which matters
	// at 40 ticks a second against a grid of thousands of beats.
	const first = Math.max(0, beatIndexAt(t.beats, from));
	const bars = new Set<number>();
	for (let i = first; i < t.beats.length; i++) {
		if (t.beats[i] >= to) break;
		bars.add(t.eights[i]);
		if (t.beats[i] < from) continue;
		const clip = toggles.count ? COUNT_CLIP[t.counts[i]] : null;
		const ducked = talking.has(t.eights[i]) && t.counts[i] >= CALL_POS && t.counts[i] <= 7;
		if (clip && !ducked) cues.push({ at: t.beats[i], clip });
	}

	if (toggles.clave) {
		for (const e of bars) {
			for (const pos of CLAVE_POSITIONS[toggles.clave]) {
				const at = timeAt(t, e, pos);
				if (at !== null && at >= from && at < to) cues.push({ at, clip: 'clave' });
			}
		}
	}

	cues.sort((a, b) => a.at - b.at);
	calls.sort((a, b) => a.at - b.at);
	return { cues, calls };
}

/**
 * A figure from the pool, never the one just called — hearing the same name
 * twice running reads as a bug, not as randomness. `r` is in `[0, 1)`.
 */
export function pickFigure(pool: number[], last: number | null, r: number): number | null {
	if (pool.length === 0) return null;
	const choices = last === null || pool.length === 1 ? pool : pool.filter((id) => id !== last);
	return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
}

/**
 * Grow a plan so it reaches `throughEight`, deciding only the new steps —
 * a figure already announced never changes under the player's feet.
 */
export function extendPlan(
	plan: PlanStep[],
	pool: number[],
	every: CallEvery,
	throughEight: number,
	rand: () => number
): PlanStep[] {
	const out = [...plan];
	let eight = out.length === 0 ? LEAD_IN_8S : out[out.length - 1].eight + every;
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = pickFigure(pool, last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += every;
	}
	return out;
}

/** A plain metronome grid for count-only practice: `bars` 8-counts at `bpm`. */
export function syntheticGrid(bpm: number, bars: number): { beats: number[]; counts: number[] } {
	const step = 60 / bpm;
	const n = bars * 8;
	return {
		beats: Array.from({ length: n }, (_, i) => i * step),
		counts: Array.from({ length: n }, (_, i) => (i % 8) + 1)
	};
}
```

- [ ] **Step 4: Run the tests until they pass**

```bash
npx vitest run src/lib/scheduler
```

Expected: all pass. Fix the implementation, not the tests, unless a test is
demonstrably wrong about the spec — say which and why in the report.

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/lib/scheduler
git commit -m "scheduler: pure cues — count, clave, calls on the 5 before"
```

---

## Task 4: `attach.ts` — the audio clock

**Files:**
- Create: `src/lib/scheduler/attach.ts`

**Interfaces:**
- Consumes: everything Task 3 produced; `CLIPS` from `$lib/labels`.
- Produces: `createPlayer(opts): PlayerHandle`, `loadClips(ctx)`.

This file is the only impure part of the module and is not unit-tested — it is
verified by ear in Task 8. Keep every decision that CAN be pure in `scheduler.ts`.

- [ ] **Step 1: Write it**

`src/lib/scheduler/attach.ts`:

```ts
/**
 * The impure half of the player: an AudioContext, the decoded clips, and a
 * look-ahead loop that turns `scheduler.ts`'s song-time cues into sound.
 *
 * Why a look-ahead loop and not `setTimeout` per beat: timers drift and get
 * throttled in a background tab, and a count that lands 40 ms late is audibly
 * wrong. Instead a 25 ms tick schedules everything falling inside the next
 * 100 ms directly on the audio clock, which is sample-accurate and immune to
 * main-thread jank. (The standard "A Tale of Two Clocks" pattern.)
 */
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import { CLIPS, type CallEvery, type Clip } from '$lib/labels';
import {
	type PlanStep,
	type Timeline,
	type Toggles,
	cuesIn,
	extendPlan,
	timeline
} from './scheduler';

const TICK_MS = 25;
const HORIZON_S = 0.1;
/** A jump larger than this means the user seeked; everything queued is stale. */
const SEEK_EPSILON_S = 0.25;

export async function loadClips(ctx: AudioContext): Promise<Record<Clip, AudioBuffer>> {
	const pairs = await Promise.all(
		CLIPS.map(async (name) => {
			const res = await fetch(`/clips/${name}.m4a`);
			if (!res.ok) throw new Error(`clip ${name}: ${res.status}`);
			// decodeAudioData detaches the buffer, so each clip needs its own.
			return [name, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
		})
	);
	return Object.fromEntries(pairs) as Record<Clip, AudioBuffer>;
}

export interface PlayerOptions {
	/** The song element, or null for count-only against the context clock. */
	audio: HTMLAudioElement | null;
	grid: { beats: number[]; counts: number[] };
	toggles: Toggles;
	/** Figure ids the drill may call. */
	pool: number[];
	/** What the voice says for a figure — `say`, not necessarily the name. */
	sayOf: (figureId: number) => string;
	/** Count and clave loudness, 0–1, independent of the music. */
	voiceVolume: number;
	onCall: (figureId: number) => void;
	onEnd: () => void;
}

export interface PlayerHandle {
	start(): Promise<void>;
	stop(): void;
	setToggles(t: Toggles): void;
	setVoiceVolume(v: number): void;
	setPool(pool: number[]): void;
	/** Current position in song seconds — read every frame for the on-screen count. */
	songTime(): number;
	/** The plan as decided so far, for "save as set". */
	called(): number[];
}

export function createPlayer(opts: PlayerOptions): PlayerHandle {
	let ctx: AudioContext | null = null;
	let clips: Record<Clip, AudioBuffer> | null = null;
	let gain: GainNode | null = null;
	let tick = 0;
	let wakeLock: WakeLockSentinel | null = null;

	let tl: Timeline = timeline(opts.grid);
	let toggles = opts.toggles;
	let pool = opts.pool;
	let volume = opts.voiceVolume;
	let plan: PlanStep[] = [];
	const calledIds: number[] = [];

	/** Song time already scheduled up to. Reset on a seek. */
	let cursor = 0;
	let queued: AudioBufferSourceNode[] = [];
	let speechTimers: ReturnType<typeof setTimeout>[] = [];
	/** Context origin for count-only, where there is no media element. */
	let origin = 0;

	const rate = () => opts.audio?.playbackRate ?? 1;

	const songNow = () =>
		opts.audio ? opts.audio.currentTime : ctx ? (ctx.currentTime - origin) * rate() : 0;

	/** Context time at which a given song time arrives, at the current rate. */
	const ctxAt = (songTime: number) => {
		if (!ctx) return 0;
		return opts.audio
			? ctx.currentTime + (songTime - opts.audio.currentTime) / rate()
			: origin + songTime / rate();
	};

	const lastBeat = () => tl.beats[tl.beats.length - 1] ?? 0;

	function clearQueued() {
		for (const src of queued) {
			try {
				src.stop();
			} catch {
				// Already finished; stopping a spent source throws and means nothing.
			}
		}
		queued = [];
		for (const t of speechTimers) clearTimeout(t);
		speechTimers = [];
	}

	function say(text: string) {
		const speech = globalThis.speechSynthesis;
		if (!speech) return;
		// A queued call from a bar we have left would talk over the current one.
		speech.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.rate = 1.1;
		speech.speak(u);
	}

	function schedule() {
		if (!ctx || !clips || !gain) return;
		const now = songNow();

		// A seek (or a loop back to the start) invalidates everything queued.
		if (now < cursor - SEEK_EPSILON_S || now > cursor + SEEK_EPSILON_S) {
			clearQueued();
			cursor = now;
		}

		const until = now + HORIZON_S * rate();
		if (until <= cursor) return;

		if (toggles.callEvery !== null && pool.length > 0) {
			// Decide calls a bar or two ahead of where we are scheduling sound.
			const through = eightAt(until) + 2;
			plan = extendPlan(plan, pool, toggles.callEvery as CallEvery, through, Math.random);
		}

		const { cues, calls } = cuesIn(tl, plan, toggles, cursor, until);

		for (const cue of cues) {
			const src = ctx.createBufferSource();
			src.buffer = clips[cue.clip];
			src.connect(gain);
			src.start(Math.max(ctx.currentTime, ctxAt(cue.at)));
			src.onended = () => {
				queued = queued.filter((q) => q !== src);
			};
			queued.push(src);
		}

		for (const call of calls) {
			const delay = Math.max(0, (ctxAt(call.at) - ctx.currentTime) * 1000);
			speechTimers.push(
				setTimeout(() => {
					say(opts.sayOf(call.figureId));
					calledIds.push(call.figureId);
					opts.onCall(call.figureId);
				}, delay)
			);
		}

		cursor = until;
		if (!opts.audio && now > lastBeat()) opts.onEnd();
	}

	/** Which 8-count a song time falls in — for deciding how far ahead to plan. */
	function eightAt(songTime: number): number {
		const i = beatIndexAt(tl.beats, songTime);
		return i < 0 ? 0 : tl.eights[i];
	}

	async function takeWakeLock() {
		try {
			wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
		} catch {
			// Denied or unsupported — practising with the screen going dark is
			// worse, not broken.
		}
	}

	const onVisible = () => {
		if (document.visibilityState === 'visible' && ctx) void takeWakeLock();
	};

	return {
		async start() {
			// Created inside the Play handler: iOS only unlocks audio from a gesture.
			ctx = new AudioContext();
			await ctx.resume();
			gain = ctx.createGain();
			gain.gain.value = volume;
			gain.connect(ctx.destination);
			clips = await loadClips(ctx);

			// Prime the speech engine in the same gesture, or the first call is
			// swallowed on iOS.
			const u = new SpeechSynthesisUtterance(' ');
			u.volume = 0;
			globalThis.speechSynthesis?.speak(u);

			origin = ctx.currentTime;
			cursor = songNow();
			await opts.audio?.play();
			await takeWakeLock();
			document.addEventListener('visibilitychange', onVisible);
			tick = setInterval(schedule, TICK_MS) as unknown as number;
		},

		stop() {
			clearInterval(tick);
			clearQueued();
			globalThis.speechSynthesis?.cancel();
			document.removeEventListener('visibilitychange', onVisible);
			opts.audio?.pause();
			void wakeLock?.release();
			wakeLock = null;
			void ctx?.close();
			ctx = null;
			clips = null;
			gain = null;
		},

		setToggles(next) {
			toggles = next;
			clearQueued();
			cursor = songNow();
		},

		setVoiceVolume(v) {
			volume = v;
			if (gain) gain.gain.value = v;
		},

		setPool(next) {
			pool = next;
		},

		songTime: songNow,
		called: () => [...calledIds]
	};
}
```

- [ ] **Step 2: Make the types and lint pass**

```bash
npm run check
```

**Do NOT add a `declare global` block for `navigator.wakeLock`.** Measured in
this worktree: the TypeScript DOM lib here already declares it, so redeclaring
collides —

```
All declarations of 'wakeLock' must have identical modifiers. [2687]
Property 'wakeLock' must be of type 'WakeLock' [2717]
```

Use the built-in types directly: `navigator.wakeLock` is non-optional and
`WakeLockSentinel` resolves on its own. Guard at runtime instead of in the type
system, because Safari and Firefox genuinely lack it:

```ts
let wakeLock: WakeLockSentinel | null = null;
…
try {
	wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
} catch {
	// Denied, or no support — the screen dimming mid-practice is worse than
	// this is broken.
}
```

`navigator.wakeLock?.` still compiles against a non-optional declaration and is
what keeps a browser without the API from throwing. Do not reach for `any` and
do not disable the lint rule.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scheduler/attach.ts
git commit -m "scheduler: audio-clock attachment, look-ahead, speech and wake lock"
```

---

## Task 5: The player page

**Files:**
- Create: `src/routes/player/+page.server.ts`
- Create: `src/routes/player/+page.svelte`
- Create: `src/lib/components/player/Setup.svelte`
- Create: `src/lib/components/player/Running.svelte`

**Interfaces:**
- Consumes: `createPlayer` (Task 4), `buildGrid` from `$lib/beatgrid/beatgrid`,
  `listCallableFigures` / `listReadySongs` (Task 1), `LiveCount.svelte`.
- Produces: the route `/player?song=<id>` | `/player?bpm=<n>`, both accepting
  `&exercise=<id>`; the `save` action consumed by Task 6.

- [ ] **Step 1: The load function**

`src/routes/player/+page.server.ts` — read the song (if any), build its grid
exactly as `src/routes/songs/[id]/+page.server.ts` does (reuse that file's
`parse` helper shape), and list the callable figures:

```ts
export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const songId = Number(url.searchParams.get('song')) || null;
	const bpm = Number(url.searchParams.get('bpm')) || null;
	const exerciseId = Number(url.searchParams.get('exercise')) || null;

	const song = songId ? getSong(db, songId) : null;
	if (songId && (!song || song.archivedAt !== null || song.status !== 'ready')) {
		throw error(404, 'No analysed song here');
	}

	return {
		song: song && { id: song.id, title: song.title, audioFile: song.audioFile },
		grid: song
			? buildGrid({
					beats: parse(song.beatsJson),
					downbeats: parse(song.downbeatsJson),
					anchors: parse(song.anchorsJson),
					tempoFactor: song.tempoFactor as TempoFactor
				})
			: null,
		bpm: bpm && bpm >= 60 && bpm <= 300 ? bpm : song ? null : 180,
		figures: listCallableFigures(db),
		exercise: exerciseId ? getExercise(db, exerciseId) : null,
		exercises: listExercises(db).map((e) => ({ id: e.id, name: e.name }))
	};
};
```

Add NO new exercise helpers: `getExercise` (added in Task 1) and
`listExercises` (which already excludes archived rows) cover both needs. Narrow
`listExercises` to `{ id, name }` at the call site so the page payload stays
small — Task 6's save sheet only needs those two fields.

- [ ] **Step 2: Setup.svelte**

A form-free settings panel (state lives in the page, not the server):

- **Source** — shown only when both are possible: "This song" / "Count only",
  with a BPM number input (60–300, default 180) for count-only.
- **Voice count** toggle; **Clave** off / 3-2 / 2-3; **Calls** off / every 1 / 2
  / 4 8-counts; **Speed** chips from `SPEEDS` (song only); **Voice volume**
  range 0–1.
- **Figures** — a checkbox per `data.figures`, all checked by default, with
  "All" and "None" buttons. Persist the checked ids and every toggle under
  `localStorage['salsa.player']`, wrapped in try/catch (private mode throws),
  and fall back to the defaults when it is missing or unparseable.
- A single full-width **Play** button, ≥ 56 px tall.

Use the existing `chip` class string from `FigureFields.svelte` for the
radio-style choices so the page matches the rest of the app.

- [ ] **Step 3: Running.svelte**

- `LiveCount` shows the number. **It needs a small refactor first**, and this is
  a real seam, not a detail: today it takes `audio: HTMLAudioElement` and reads
  `el.currentTime` in its own animation frame, but count-only practice has no
  media element at all. Change its prop from `audio` to
  `time: () => number | null` — a getter it polls each frame, returning null
  when there is no position yet:

  ```ts
  interface Props {
  	time: () => number | null;
  	beats: number[];
  	counts: number[];
  }
  ```

  Inside, replace `beatIndexAt(beats, el.currentTime)` with a null check on
  `time()`. Then update the ONE existing caller,
  `src/routes/songs/[id]/+page.svelte`, to pass
  `time={() => audio?.currentTime ?? null}` — verify that page still counts
  correctly afterwards. The player passes `time={() => player.songTime()}`.
  Doing it this way keeps one component counting for both screens instead of
  forking a near-copy.
- The figure just called, large; below it, small, the elapsed time via
  `clock()` from `$lib/format`.
- **Pause** and **Stop**. Pause calls `player.pause()` / `player.resume()` —
  added to `PlayerHandle` in Task 4, and the ONLY correct way to pause: pausing
  the `<audio>` element alone leaves the ~100 ms already committed to the audio
  clock still sounding, and count-only has no element to pause at all. Never
  fake a pause with `stop()` then `start()`; that re-fetches the clips and
  throws away the figures already planned. Stop calls `player.stop()` and raises
  the save sheet.
- For a song, the `<audio>` element stays in the DOM (`controls`, so seeking
  still works) with `preservesPitch = true` set in an `$effect` and
  `playbackRate` bound to the chosen speed.

- [ ] **Step 4: Wire the page**

`+page.svelte` holds `mode: 'setup' | 'running' | 'done'`, the settings object,
and the `PlayerHandle`. On Play it builds the grid — `data.grid` for a song, or
`syntheticGrid(bpm, 400)` for count-only (400 8-counts ≈ 17 min at 180 BPM) —
calls `createPlayer(...)`, and `await player.start()` inside the click handler
so iOS unlocks audio. `onDestroy` and a `beforeunload` listener must call
`player.stop()`, or a navigation leaves an AudioContext and a wake lock alive.

- [ ] **Step 5: Check by hand**

```bash
npm run dev
```

Open `/player?bpm=180`, press Play, and confirm: the count speaks on the beat,
the clave ticks where the tests said it would, a figure is called after two
8-counts and the count ducks under it, Stop silences everything at once. Then
open a ready song's `/player?song=<id>` and confirm the same over music, plus
that seeking the audio keeps the count in place and 0.7× still counts correctly.
Check the layout at 375 px.

- [ ] **Step 6: Commit**

```bash
npm run check
git add src/routes/player src/lib/components/player src/lib/server/exercises.ts
git commit -m "player: setup and running screens over a song or a plain BPM"
```

---

## Task 6: Save as set

**Files:**
- Create: `src/lib/components/player/SaveSetSheet.svelte`
- Modify: `src/routes/player/+page.server.ts`
- Modify: `src/routes/player/+page.svelte`

**Interfaces:**
- Consumes: `logSet` with `playerJson` (Task 1), `Sheet.svelte`,
  `player.called()` (Task 4).

- [ ] **Step 1: The action**

In `src/routes/player/+page.server.ts`:

```ts
export const actions: Actions = {
	/** Log the finished run as a set on the exercise it was practised for. */
	save: async ({ request }) => {
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const durationS = optionalInt(form, 'durationS', 0, 24 * 3600);
		const rating = optionalInt(form, 'rating', 1, 5);
		const note = optionalText(form, 'note', 2000);
		const run = optionalText(form, 'run', 4000);
		if (exerciseId === undefined || durationS === undefined || rating === undefined) {
			return fail(400, { message: 'Could not save that run.' });
		}
		if (note === undefined || run === undefined) {
			return fail(400, { message: 'That note is too long.' });
		}
		logSet(getDb(), {
			exerciseId,
			doneAt: Date.now(),
			durationS,
			reps: null,
			rating,
			note,
			playerJson: run
		});
		throw redirect(303, '/');
	}
};
```

- [ ] **Step 2: The sheet**

`SaveSetSheet.svelte` — a `Sheet` titled "Save this run", showing the duration
and how many figures were called, with a 1–5 rating, an optional note, "Save"
and "Don't save" (which navigates back). The exercise is a hidden input when the
run was opened from one, and a `<select>` over `data.exercises` otherwise.

`run` is `JSON.stringify({ speed, count, clave, callEvery, called })` built in
the page from the settings and `player.called()`.

- [ ] **Step 3: Verify**

Run a short count-only drill, stop it, save it with a rating, and confirm the
Today page shows the exercise under "Done today" with its duration. Check the
row in the database:

```bash
sqlite3 .data/salsa.db "select duration_s, rating, player_json from sets order by id desc limit 1"
```

- [ ] **Step 4: Commit**

```bash
npm run check
git add src/routes/player src/lib/components/player
git commit -m "player: a finished run logs a set with what it was"
```

---

## Task 7: Entry points

**Files:**
- Modify: `src/routes/songs/[id]/+page.svelte`
- Modify: `src/routes/songs/+page.svelte`
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/today/LogSheet.svelte`
- Modify: `src/lib/components/figures/FigureFields.svelte`
- Modify: `src/routes/figures/+page.server.ts`, `src/routes/figures/[id]/+page.server.ts`

- [ ] **Step 1: The figure form**

Add to `FigureFields.svelte`, after Style, taking two new props
(`callable = true`, `callText = ''`):

- a checkbox "The player may call this figure" (`name="callable"`), and
- a text input "Say it like" (`name="callText"`, `maxlength="200"`,
  placeholder "only if the voice mispronounces the name").

Both figure actions must read them — `checkbox(form, 'callable')` and
`optionalText(form, 'callText', 200)` — and pass them through to
`createFigure` / `updateFigure`.

- [ ] **Step 2: Practice mode in the exercise sheet**

`LogSheet.svelte` already edits frequency, active and notes. Add, inside the
same edit form:

- a three-way chip group for `practiceMode` (`PRACTICE_LABEL`),
- when `song`: a `<select name="songId">` over `data.songs` (the Today load must
  now call `listReadySongs`),
- when `count`: `<input type="number" name="countBpm" min="60" max="300">`,
- and, when the saved mode is not `none`, a **Practice** link above the log
  button, going to `/player?song=<id>&exercise=<id>` or
  `/player?bpm=<n>&exercise=<id>`.

`updateExercise` in `src/routes/+page.server.ts` reads the three fields with
`oneOf(form, 'practiceMode', PRACTICE_MODES)`, `optionalInt(form, 'songId', 1,
Number.MAX_SAFE_INTEGER)` and `optionalInt(form, 'countBpm', 60, 300)`, and
fails with a clear message when mode `song` arrives without a song or mode
`count` without a BPM.

- [ ] **Step 3: Song page and songs list**

On `src/routes/songs/[id]/+page.svelte`, above the tap button and only when
`grid && song.audioFile`, a full-width primary link:
`Practice with this song` → `/player?song={song.id}`.

On `src/routes/songs/+page.svelte`, under the upload row, a secondary link:
`Count-only drill` → `/player?bpm=180`.

- [ ] **Step 4: Verify the whole path**

From the Today page: give a custom exercise practice mode "count only" at 180,
press Practice, run it, stop, save — the set lands on that exercise. From a
song: Practice, hear the count over the music, stop without saving. Create a
figure with "Say it like" set and confirm the player speaks that instead.

- [ ] **Step 5: Commit**

```bash
npm run check
git add -A
git commit -m "player: reachable from a song, an exercise and the songs list"
```

---

## Task 8: Ship it

- [ ] **Step 1: Full check**

```bash
npm run check
```

- [ ] **Step 2: Merge and deploy**

Merge `phase-2b` into `master` per superpowers:finishing-a-development-branch,
then:

```bash
./scripts/deploy.sh prod
curl -sf https://salsa.anotherroot.eu/health
```

- [ ] **Step 3: Hand the phone checks to the user**

They are the only ones that matter and none can be automated:

- the count stays on the beat for a whole song;
- the screen does not sleep mid-run;
- the voice survives locking and unlocking the phone;
- the iPhone silent switch mutes the voice but not the music (expected — warn
  in the UI);
- a saved run appears under Done today;
- **×1 or ×2** — which matches their steps. Still open from phase 2a, and this
  is the screen that answers it.

## Verification

- `npm run check` passes at every commit.
- `src/lib/scheduler/scheduler.spec.ts` covers: the clip for each count, silence
  on 4 and 8, both clave patterns against hand-computed times, a call on the 5
  of the preceding 8-count, the count ducking under it, the rest of the bar
  still counted, no figure twice running, an empty pool, and the synthetic
  grid's spacing.
- By ear locally: count-only at 180 BPM, then a real song at 1× and 0.7×, with
  a seek mid-song.
- On the phone, by the user: the list in Task 8 Step 3.
