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
	/** Hold the run in place, keeping the loaded clips and the decided plan. */
	pause(): void;
	resume(): Promise<void>;
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

	const tl: Timeline = timeline(opts.grid);
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
	/** Latches `onEnd`: the loop keeps ticking past the last beat, the callback must not. */
	let ended = false;
	/** Song position held while paused — count-only has no element to remember it. */
	let heldAt: number | null = null;

	const rate = () => opts.audio?.playbackRate ?? 1;

	const songNow = () =>
		heldAt !== null
			? // Paused: the context clock runs on regardless, so the held position is
				// the only honest answer — otherwise the on-screen count would keep
				// climbing through a pause.
				heldAt
			: opts.audio
				? opts.audio.currentTime
				: ctx
					? (ctx.currentTime - origin) * rate()
					: 0;

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
		// Cancelling the timers only stops calls that have not started talking.
		// Seek away mid-call and the name already in the speech queue would go
		// on announcing a figure for a part of the song we have left.
		globalThis.speechSynthesis?.cancel();
	}

	function say(text: string) {
		const speech = globalThis.speechSynthesis;
		if (!speech) return;
		// A queued call from a bar we have left would talk over the current one.
		speech.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.rate = 1.1;
		// The voice slider has to reach the NAMES too. It only feeds the clips'
		// gain node, so without this, turning the voice down to hear the music
		// fades the count and the clave and leaves the figure calls at full blast.
		u.volume = volume;
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
		// A run ends either because the song ran out or because a count-only grid
		// did. Both have to be noticed here, or the music stops and the screen
		// just sits there until the user presses Stop. The tick keeps firing 40
		// times a second, so this has to latch.
		if (!ended && (opts.audio ? opts.audio.ended : now > lastBeat())) {
			ended = true;
			opts.onEnd();
		}
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

				// Prime the speech engine in the same gesture, or the first call is
				// swallowed on iOS.
				const u = new SpeechSynthesisUtterance(' ');
				u.volume = 0;
				globalThis.speechSynthesis?.speak(u);

				origin = ctx.currentTime;
				cursor = songNow();
				await opts.audio?.play();
			} catch (e) {
				// A clip that 404s, or a play() the browser refuses, must not leave
				// an open context behind: the caller will show an error and the user
				// will press Play again, and iOS caps how many contexts may exist.
				void ctx.close();
				ctx = null;
				clips = null;
				gain = null;
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
			opts.audio?.pause();
		},

		async resume() {
			if (heldAt === null || !ctx) return;
			// Count-only measures the song from `origin`, and the context clock ran
			// on through the pause; move the origin so the count picks up where it
			// left off rather than jumping forward by however long the break was.
			if (!opts.audio) origin = ctx.currentTime - heldAt / rate();
			cursor = heldAt;
			heldAt = null;
			await opts.audio?.play();
			tick = setInterval(schedule, TICK_MS) as unknown as number;
		},

		stop() {
			clearInterval(tick);
			tick = 0;
			heldAt = null;
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
