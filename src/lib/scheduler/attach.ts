/**
 * The impure half of the player: an AudioContext, the decoded clips, and a
 * look-ahead loop that turns `scheduler.ts`'s song-time cues into sound.
 *
 * Why a look-ahead loop and not `setTimeout` per beat: timers drift and get
 * throttled in a background tab, and a count that lands 40 ms late is audibly
 * wrong. Instead a 25 ms tick schedules everything falling inside the next
 * `HORIZON_S` directly on the audio clock, which is sample-accurate and immune
 * to main-thread jank. (The standard "A Tale of Two Clocks" pattern.)
 */
import { isQuiet, type QuietRange } from './quiet';
import { countInCuesIn, type CountInCue } from '$lib/songs/count-in';
import { beatIndexAt, median } from '$lib/beatgrid/beatgrid';
import { CLIPS, type Clip } from '$lib/labels';
import type { CountTakeRow } from '$lib/types';
import { reportedDelayMs, steadyDelay, totalDelayMs } from '$lib/player/sound-delay';
import {
	COUNT_CLIP,
	type PlanStep,
	type Timeline,
	type Toggles,
	cuesIn,
	timeAt,
	timeline
} from './scheduler';

export const TICK_MS = 25;
/**
 * How far ahead each tick schedules.
 *
 * This must exceed the largest LEAD any cue needs, not just cover the gap
 * between ticks. A recorded phrase starts one pre-roll BEFORE its beat, so a
 * horizon equal to the pre-roll means the start time is already in the past by
 * the time the phrase is discovered — which is exactly what happened when both
 * were 0.1 s, and the count landed up to 100 ms late. `MAX_PRE_ROLL_S` in
 * `$lib/limits` is the ceiling the upload enforces; this stays above it.
 */
export const HORIZON_S = 0.3;
/**
 * How far a recorded take's tempo may sit from the song's before the run uses
 * the built-in clips instead. `playbackRate` shifts pitch, and 12 % is about
 * two semitones — past that the user's own voice stops sounding like it, which
 * is worse than a Piper count that at least sounds deliberate.
 */
const TAKE_TOLERANCE = 0.12;
/**
 * A jump larger than this means the user seeked; everything queued is stale.
 *
 * Derived from the horizon, never set independently: `cursor` legitimately
 * sits up to one horizon ahead of the song position, so an epsilon below that
 * reads every single tick as a seek, clears the queue, and the player falls
 * silent while looking like it is working.
 */
export const SEEK_EPSILON_S = HORIZON_S + 0.2;

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

/** A recorded half-bar, decoded and ready to schedule. */
interface LoadedPhrase {
	buffer: AudioBuffer;
	/** Seconds of audio before the phrase's first beat. */
	preRollS: number;
	/** The phrase's musical length, at the tempo it was recorded. */
	lengthS: number;
}

/**
 * The recorded set closest to the tempo this run will actually sound at, or
 * null to use the built-in clips.
 *
 * Nearest in LOG space, because tempo is multiplicative — 140 is as far from
 * 130 as 130 is from 121, not from 120.
 */
export function chooseTakes(
	takes: CountTakeRow[],
	effectiveBpm: number
): { a?: CountTakeRow; b?: CountTakeRow } | null {
	if (takes.length === 0 || !Number.isFinite(effectiveBpm) || effectiveBpm <= 0) return null;
	let best: number | null = null;
	let bestDistance = Infinity;
	for (const t of takes) {
		const d = Math.abs(Math.log(t.bpm / effectiveBpm));
		if (d < bestDistance) {
			bestDistance = d;
			best = t.bpm;
		}
	}
	if (best === null || bestDistance > Math.log(1 + TAKE_TOLERANCE)) return null;
	const set: { a?: CountTakeRow; b?: CountTakeRow } = {};
	for (const t of takes) {
		if (t.bpm === best) set[t.phrase] = t;
	}
	return set.a || set.b ? set : null;
}

async function loadPhrases(
	ctx: AudioContext,
	set: { a?: CountTakeRow; b?: CountTakeRow }
): Promise<Partial<Record<'a' | 'b', LoadedPhrase>>> {
	const out: Partial<Record<'a' | 'b', LoadedPhrase>> = {};
	await Promise.all(
		(['a', 'b'] as const).map(async (half) => {
			const take = set[half];
			if (!take) return;
			const res = await fetch(`/count/${take.file}`);
			if (!res.ok) throw new Error(`take ${take.file}: ${res.status}`);
			out[half] = {
				buffer: await ctx.decodeAudioData(await res.arrayBuffer()),
				preRollS: take.preRollS,
				lengthS: take.lengthS
			};
		})
	);
	return out;
}

export interface PlayerOptions {
	/** The song element, or null for count-only against the context clock. */
	audio: HTMLAudioElement | null;
	grid: { beats: number[]; counts: number[] };
	toggles: Toggles;
	/**
	 * A routine's walk: given the plan so far it returns the plan extended
	 * through `throughEight`, and must never change a step it has already
	 * returned — except from `from` on, which is a jump. Absent, the run is
	 * count and clave only.
	 *
	 * A function the page supplies, so this module never learns what a routine is.
	 */
	planner?: (
		plan: PlanStep[],
		throughEight: number,
		rand: () => number,
		from?: { eight: number; slot: number }
	) => PlanStep[];
	/** Count and clave loudness, 0–1, independent of the music. */
	voiceVolume: number;
	/** A song's parts with the count off (`quietRanges`): no count and no clave there. */
	quiet?: QuietRange[];
	/** A song's count-ins (`countInCues`): 5 6 7 8 on the coming tempo, spoken unless the count is off. */
	countIn?: CountInCue[];
	/**
	 * The user's recorded half-bars for the chosen pattern, if any. An empty
	 * list — or a tempo too far from every take — falls back to the shipped
	 * clips, so a half-filled ladder is a working player rather than a broken one.
	 */
	takes?: CountTakeRow[];
	/**
	 * A figure has just started, on its "1" (`at`, in song seconds). The step
	 * says which slot it answers: the same figure appears in several slots, so a
	 * figure id alone could not say where in the routine the run is. Nothing is
	 * spoken: the page shows it.
	 */
	onStep: (step: PlanStep, at: number) => void;
	onEnd: () => void;
	/**
	 * The person's own correction to how long the sound takes to reach them,
	 * in ms, on top of what the phone reports (`sound-delay.ts`). The screen
	 * waits for the sound; the sound itself is never moved.
	 */
	delayCorrectionMs?: number;
}

export interface PlayerHandle {
	start(): Promise<void>;
	/** Hold the run in place, keeping the loaded clips and the decided plan. */
	pause(): void;
	resume(): Promise<void>;
	stop(): void;
	setToggles(t: Toggles): void;
	setVoiceVolume(v: number): void;
	/**
	 * Start the routine again at `slot`, on the "1" of the 8-count the run is in:
	 * the song (or the count) goes back to that "1", so the figure starts whole.
	 * A no-op without a routine.
	 */
	jumpTo(slot: number): void;
	/**
	 * Move the run to a song time, playing or paused. Everything queued is for
	 * the place being left, so it goes, and the cursor restarts at the target.
	 */
	seek(songTime: number): void;
	/**
	 * The song position being HEARD, in song seconds — read every frame for the
	 * on-screen count. With a song, the music's own time (the voice and the
	 * clave start early to meet it); count only, behind the context clock by
	 * the sound's way to the ear (Bluetooth: ~250 ms).
	 */
	songTime(): number;
	/**
	 * What the phone reports for its sound (held still), the person's
	 * correction, in ms, and whether the run has a song — which says what the
	 * delay moves: the voice and the clave (a song) or the count on screen.
	 */
	soundDelay(): { reportedMs: number; correctionMs: number; withSong: boolean };
	setDelayCorrection(ms: number): void;
	/** The figures that have started, in order, for "save as set". */
	danced(): number[];
	/**
	 * Play another song from here on (a hearing round over several songs): the
	 * run is held, the old element paused, and the new one waits for `seek` and
	 * `resume`. Its element must have been played once inside a tap (iOS).
	 */
	setSong(next: {
		audio: HTMLAudioElement;
		grid: { beats: number[]; counts: number[] };
		quiet?: QuietRange[];
	}): void;
}

export function createPlayer(opts: PlayerOptions): PlayerHandle {
	let ctx: AudioContext | null = null;
	let clips: Record<Clip, AudioBuffer> | null = null;
	let gain: GainNode | null = null;
	let tick = 0;
	let wakeLock: WakeLockSentinel | null = null;

	/** The song the run plays; a hearing round over several songs swaps it between spots (`setSong`). */
	const song = { audio: opts.audio, quiet: opts.quiet };
	let tl: Timeline = timeline(opts.grid);
	let toggles = opts.toggles;
	let volume = opts.voiceVolume;
	let plan: PlanStep[] = [];
	/** Decoded recorded halves, empty when the run uses the built-in clips. */
	let phrases: Partial<Record<'a' | 'b', LoadedPhrase>> = {};
	const dancedIds: number[] = [];
	/** The last step reported, so one replayed by a seek or a jump is not logged twice running. */
	let lastStepEight: number | null = null;

	/** Song time already scheduled up to. Reset on a seek. */
	let cursor = 0;
	let queued: AudioBufferSourceNode[] = [];
	let stepTimers: ReturnType<typeof setTimeout>[] = [];
	/** Context origin for count-only, where there is no media element. */
	let origin = 0;
	/** Latches `onEnd`: the loop keeps ticking past the last beat, the callback must not. */
	let ended = false;
	/** Song position held while paused — count-only has no element to remember it. */
	let heldAt: number | null = null;
	let delayCorrectionMs = opts.delayCorrectionMs ?? 0;
	/** What the phone reports, held still: it wobbles ±20 ms from moment to moment. */
	const reported = steadyDelay();

	/**
	 * Seconds from a sound leaving the context to it reaching the ear: ~10–40 ms
	 * on the speaker or a wire, ~250 ms on Bluetooth. The song's `currentTime`
	 * already allows for it (the browser does that for media), the context's
	 * clock does not.
	 */
	const heardDelayS = () => totalDelayMs(reported.ms, delayCorrectionMs) / 1000;

	const rate = () => song.audio?.playbackRate ?? 1;

	/**
	 * The song position being HEARD. With a song, the element's own time; with
	 * the count only, the context clock less the sound's way to the ear.
	 */
	const songNow = () =>
		heldAt !== null
			? // Paused: the context clock runs on regardless, so the held position is
				// the only honest answer — otherwise the on-screen count would keep
				// climbing through a pause.
				heldAt
			: song.audio
				? song.audio.currentTime
				: ctx
					? (ctx.currentTime - heardDelayS() - origin) * rate()
					: 0;

	/**
	 * Context time at which to START the sound for a given song time, at the
	 * current rate. With a song, that is early by the sound's way to the ear, so
	 * the voice and the clave reach it with the music. Count only, the count's
	 * own timeline is the sound's, and the screen waits instead (`songNow`).
	 */
	const ctxAt = (songTime: number) => {
		if (!ctx) return 0;
		return song.audio
			? ctx.currentTime - heardDelayS() + (songTime - song.audio.currentTime) / rate()
			: origin + songTime / rate();
	};

	/**
	 * A start this far in the past is skipped, not played late. Right after Play,
	 * a seek or a resume, a song's first ~quarter second of cues would have had
	 * to start before now to arrive on time; played late, they would land
	 * together as a burst. A cue only a tick late still plays, as it always did.
	 */
	const LATE_OK_S = 0.05;
	const tooLate = (when: number) => !!ctx && when < ctx.currentTime - LATE_OK_S;

	const lastBeat = () => tl.beats[tl.beats.length - 1] ?? 0;

	/** Warned once per run; a late cue repeats forty times a second. */
	let warnedLate = false;

	/**
	 * Clamp a start time to now, and SAY SO. A cue whose time has already passed
	 * plays late, and clamping silently is how a 100 ms error hid in plain sight:
	 * the horizon was equal to the pre-roll, so every recorded phrase was rescued
	 * here instead of being scheduled properly. If this fires, the horizon is too
	 * short for the lead some cue needs — it is not a rounding artefact.
	 */
	function startAt(when: number): number {
		if (!ctx) return 0;
		if (when < ctx.currentTime - 0.005 && !warnedLate) {
			warnedLate = true;
			console.warn(
				`[player] a cue was scheduled ${Math.round((ctx.currentTime - when) * 1000)} ms in the past; ` +
					`the look-ahead horizon (${HORIZON_S}s) is shorter than the lead it needs.`
			);
		}
		return Math.max(ctx.currentTime, when);
	}

	/**
	 * The grid's own tempo, from the median gap between beats — the same measure
	 * `bpmOf` uses, and robust to the odd mis-detected beat in a way a mean is not.
	 */
	const gridBpm = () => {
		if (tl.beats.length < 2) return 0;
		const gaps = tl.beats.slice(1).map((b, i) => b - tl.beats[i]);
		const m = median(gaps);
		return m > 0 ? 60 / m : 0;
	};

	function clearQueued() {
		for (const src of queued) {
			try {
				src.stop();
			} catch {
				// Already finished; stopping a spent source throws and means nothing.
			}
		}
		queued = [];
		for (const t of stepTimers) clearTimeout(t);
		stepTimers = [];
	}

	function stepStarted(step: PlanStep, at: number) {
		if (step.eight !== lastStepEight) dancedIds.push(step.figureId);
		lastStepEight = step.eight;
		opts.onStep(step, at);
	}

	function schedule() {
		if (!ctx || !clips || !gain) return;
		reported.read(reportedDelayMs(ctx));
		const now = songNow();
		/** With a song, cues start early by this much, so the window reaches that much further. */
		const lead = song.audio ? heardDelayS() * rate() : 0;

		// A run ends either because the song ran out or because a count-only grid
		// did. Both have to be noticed here, or the music stops and the screen
		// just sits there until the user presses Stop. Checked FIRST: once the
		// song has stopped moving, `until` stops growing and the early return
		// below fires on every tick — and `currentTime` reaches the duration a
		// moment before `ended` turns true, so a tick can land in between. The
		// tick keeps firing 40 times a second, so this has to latch.
		if (ended) return;
		if (song.audio ? song.audio.ended : now > lastBeat()) {
			ended = true;
			opts.onEnd();
			return;
		}

		// A seek (or a loop back to the start) invalidates everything queued.
		if (now < cursor - SEEK_EPSILON_S - lead || now > cursor + SEEK_EPSILON_S) {
			clearQueued();
			cursor = now;
		}

		const until = now + HORIZON_S * rate() + lead;
		if (until <= cursor) return;

		// Decide the routine a bar or two ahead of where we are scheduling sound.
		if (opts.planner) plan = opts.planner(plan, eightAt(until) + 2, Math.random);

		const found = cuesIn(tl, plan, toggles, cursor, until);
		const quiet = song.quiet ?? [];
		const cues = found.cues.filter((c) => !isQuiet(quiet, c.at));
		if (toggles.count !== 'off')
			for (const c of countInCuesIn(opts.countIn ?? [], cursor, until))
				cues.push({ at: c.at, clip: COUNT_CLIP[c.n] });
		const due = found.phrases.filter((p) => !isQuiet(quiet, p.at));
		const steps = found.steps;

		for (const cue of cues) {
			if (tooLate(ctxAt(cue.at))) continue;
			const src = ctx.createBufferSource();
			src.buffer = clips[cue.clip];
			src.connect(gain);
			src.start(Math.max(ctx.currentTime, ctxAt(cue.at)));
			src.onended = () => {
				queued = queued.filter((q) => q !== src);
			};
			queued.push(src);
		}

		for (const phrase of due) {
			const take = phrases[phrase.half];
			if (!take) continue;
			// The phrase's length in WALL-CLOCK seconds: song times shrink as the
			// song plays faster, and the take has to be stretched to match what the
			// ear will hear, not what the song's own timeline says.
			const wall = (phrase.endsAt - phrase.at) / rate();
			const speed = take.lengthS / wall;
			if (tooLate(ctxAt(phrase.at) - take.preRollS / speed)) continue;
			const src = ctx.createBufferSource();
			src.buffer = take.buffer;
			src.playbackRate.value = speed;
			src.connect(gain);
			// The pre-roll is audio BEFORE the first beat, in the take's own
			// timebase, so it occupies less context time the faster the take plays.
			src.start(startAt(ctxAt(phrase.at) - take.preRollS / speed));
			src.onended = () => {
				queued = queued.filter((q) => q !== src);
			};
			queued.push(src);
		}

		// Shown, not heard: a timer is near enough for the eye, and it is
		// cleared with everything queued on a seek. It shows when its "1" is
		// heard, as the count does.
		for (const { at, step } of steps) {
			const delay = Math.max(0, ((at - now) / rate()) * 1000);
			stepTimers.push(setTimeout(() => stepStarted(step, at), delay));
		}

		cursor = until;
	}

	function seek(to: number) {
		const t = Math.max(0, to);
		clearQueued();
		if (song.audio) song.audio.currentTime = t;
		else if (ctx) origin = ctx.currentTime - heardDelayS() - t / rate();
		// Paused, the held position IS the run's position: without this the
		// count on screen would stay where it was, and resume would schedule
		// from there while the music plays from the new spot.
		if (heldAt !== null) heldAt = t;
		cursor = t;
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
			try {
				await ctx.resume();
				gain = ctx.createGain();
				gain.gain.value = volume;
				gain.connect(ctx.destination);
				clips = await loadClips(ctx);

				// Decided once, here, rather than per tick: the song has one tempo,
				// and a count that changed source halfway through a run would be far
				// more disconcerting than one that is Piper's throughout.
				const set = chooseTakes(opts.takes ?? [], gridBpm() * rate());
				phrases = set ? await loadPhrases(ctx, set) : {};
				toggles = { ...toggles, phrases: Boolean(phrases.a || phrases.b) };

				reported.read(reportedDelayMs(ctx));
				origin = ctx.currentTime;
				cursor = songNow();
				await song.audio?.play();
			} catch (e) {
				// A clip that 404s, or a play() the browser refuses, must not leave
				// an open context behind: the caller will show an error and the user
				// will press Play again, and iOS caps how many contexts may exist.
				void ctx.close();
				ctx = null;
				clips = null;
				gain = null;
				phrases = {};
				throw e;
			}
			await takeWakeLock();
			document.addEventListener('visibilitychange', onVisible);
			tick = setInterval(schedule, TICK_MS) as unknown as number;
		},

		/**
		 * Hold the run where it is. The media element and the audio clock are
		 * separate, so pausing the element alone would let the ~100 ms already
		 * committed to the context keep sounding after the user thinks they have
		 * stopped — and count-only has no element to pause at all.
		 */
		pause() {
			if (heldAt !== null) return;
			heldAt = songNow();
			clearInterval(tick);
			tick = 0;
			clearQueued();
			song.audio?.pause();
		},

		async resume() {
			if (heldAt === null || !ctx) return;
			// Count-only measures the song from `origin`, and the context clock ran
			// on through the pause; move the origin so the count picks up where it
			// left off rather than jumping forward by however long the break was.
			if (!song.audio) origin = ctx.currentTime - heardDelayS() - heldAt / rate();
			cursor = heldAt;
			heldAt = null;
			await song.audio?.play();
			tick = setInterval(schedule, TICK_MS) as unknown as number;
		},

		stop() {
			clearInterval(tick);
			tick = 0;
			heldAt = null;
			clearQueued();
			document.removeEventListener('visibilitychange', onVisible);
			song.audio?.pause();
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

		jumpTo(slot) {
			if (!opts.planner) return;
			const now = songNow();
			// The 8-count the run is in; before the first "1", the first one.
			const eight = Math.max(0, eightAt(now));
			const at = timeAt(tl, eight, 1);
			if (at === null) return;
			plan = opts.planner(plan, eight + 2, Math.random, { eight, slot });
			seek(at);
			const step = plan.find((s) => s.eight === eight);
			// At once, not at the next tick: paused, there is no tick to report it.
			if (step) stepStarted(step, at);
		},

		seek,

		songTime: () => Math.max(0, songNow()),
		soundDelay: () => ({
			reportedMs: reported.ms,
			correctionMs: delayCorrectionMs,
			withSong: song.audio !== null
		}),
		setDelayCorrection(ms) {
			delayCorrectionMs = ms;
		},
		danced: () => [...dancedIds],

		setSong(next) {
			// Only while held: the old element stops, the new one waits at its start for `seek` and `resume`.
			if (heldAt === null) this.pause();
			song.audio?.pause();
			song.audio = next.audio;
			song.quiet = next.quiet;
			tl = timeline(next.grid);
			ended = false;
			clearQueued();
			heldAt = next.audio.currentTime;
			cursor = heldAt;
		}
	};
}
