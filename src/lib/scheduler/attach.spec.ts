import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountTakeRow } from '$lib/types';
import { chooseTakes, createPlayer, TICK_MS } from './attach';
import type { PlanStep } from './scheduler';

/**
 * `attach.ts` is the impure half and is otherwise judged by ear, but this one
 * decision is pure arithmetic and decides whether the user's own voice is used
 * at all — a wrong answer is silent, either falling back when it need not or
 * pitching a take far enough to stop sounding like them.
 */
const take = (bpm: number, phrase: 'a' | 'b'): CountTakeRow => ({
	id: bpm * 10 + (phrase === 'a' ? 1 : 2),
	pattern: 'salsa',
	bpm,
	phrase,
	file: `${bpm}${phrase}.wav`,
	preRollS: 0.1,
	lengthS: (3 * 60) / bpm
});

const ladder = [120, 130, 140, 152, 164, 177, 191].flatMap((b) => [take(b, 'a'), take(b, 'b')]);

describe('chooseTakes', () => {
	it('returns both halves of the nearest tempo', () => {
		const set = chooseTakes(ladder, 141);
		expect(set?.a?.bpm).toBe(140);
		expect(set?.b?.bpm).toBe(140);
	});

	/**
	 * Tempo is multiplicative, so the tie between two rungs falls at their
	 * GEOMETRIC mean, not the arithmetic one: √(130 × 140) = 134.90, while the
	 * arithmetic midpoint is 135. Between those two numbers the answers differ,
	 * and log space is the one that matches what the stretch actually costs.
	 */
	it('measures distance in log space, not linear', () => {
		expect(chooseTakes(ladder, 134.95)?.a?.bpm).toBe(140); // linear would say 130
		expect(chooseTakes(ladder, 134.8)?.a?.bpm).toBe(130);
	});

	it('falls back when every take is more than 12 % away', () => {
		expect(chooseTakes(ladder, 250)).toBeNull();
		expect(chooseTakes(ladder, 60)).toBeNull();
		// 191 × 1.12 ≈ 214: just inside, and just outside.
		expect(chooseTakes(ladder, 210)?.a?.bpm).toBe(191);
		expect(chooseTakes(ladder, 220)).toBeNull();
	});

	it('accepts a tempo with only one half recorded', () => {
		const set = chooseTakes([take(140, 'a')], 140);
		expect(set?.a?.bpm).toBe(140);
		expect(set?.b).toBeUndefined();
	});

	it('falls back when nothing is recorded', () => {
		expect(chooseTakes([], 140)).toBeNull();
	});

	/** A grid with no beats yields a BPM of 0; that must not pick a take. */
	it('falls back on a nonsense tempo rather than dividing by it', () => {
		expect(chooseTakes(ladder, 0)).toBeNull();
		expect(chooseTakes(ladder, NaN)).toBeNull();
	});
});

/**
 * Just enough of the browser for `start()` and the tick to run under vitest:
 * a context whose clock the test moves, clips that decode to nothing, and no
 * wake lock. Nothing here is listened to — these tests are about when the run
 * says it has ended, not about what it sounds like.
 */
function fakeBrowser() {
	const ctx = {
		currentTime: 0,
		destination: {},
		resume: async () => {},
		close: async () => {},
		createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
		decodeAudioData: async () => ({ duration: 0.2 }),
		createBufferSource: () => ({
			buffer: null,
			playbackRate: { value: 1 },
			connect: () => {},
			start: () => {},
			stop: () => {},
			onended: null
		})
	};
	vi.stubGlobal(
		'AudioContext',
		class {
			constructor() {
				return ctx;
			}
		}
	);
	vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(8)));
	vi.stubGlobal('document', {
		visibilityState: 'visible',
		addEventListener: () => {},
		removeEventListener: () => {}
	});
	return ctx;
}

describe('the end of a song', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const beats = Array.from({ length: 16 }, (_, i) => i * 0.5);
	const counts = beats.map((_, i) => (i % 8) + 1);

	it('ends the run even when a tick reached the last second before the element said so', async () => {
		fakeBrowser();
		// `currentTime` reaches the duration a moment before `ended` turns true;
		// a tick that lands in that moment has already scheduled up to there.
		const audio = {
			currentTime: 0,
			playbackRate: 1,
			ended: false,
			play: async () => {},
			pause() {}
		};
		const onEnd = vi.fn();
		const player = createPlayer({
			audio: audio as unknown as HTMLAudioElement,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			voiceVolume: 1,
			onStep: () => {},
			onEnd
		});
		await player.start();

		audio.currentTime = 7.9;
		await vi.advanceTimersByTimeAsync(TICK_MS);
		audio.currentTime = 8;
		await vi.advanceTimersByTimeAsync(TICK_MS);
		audio.ended = true;
		await vi.advanceTimersByTimeAsync(TICK_MS * 4);

		expect(onEnd).toHaveBeenCalledTimes(1);
		player.stop();
	});

	it('ends a count-only run once, after its last beat', async () => {
		const ctx = fakeBrowser();
		const onEnd = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			voiceVolume: 1,
			onStep: () => {},
			onEnd
		});
		await player.start();

		ctx.currentTime = 7;
		await vi.advanceTimersByTimeAsync(TICK_MS);
		expect(onEnd).not.toHaveBeenCalled();
		ctx.currentTime = 8;
		await vi.advanceTimersByTimeAsync(TICK_MS * 4);
		expect(onEnd).toHaveBeenCalledTimes(1);
		player.stop();
	});
});

describe('a quiet part of a song', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const beats = Array.from({ length: 32 }, (_, i) => i * 0.5);
	const counts = beats.map((_, i) => (i % 8) + 1);

	async function sounded(
		quiet: { from: number; to: number }[],
		countIn: { at: number; n: number }[] = [],
		count: 'all' | 'off' = 'all'
	) {
		const ctx = fakeBrowser();
		let started = 0;
		ctx.createBufferSource = () => ({
			buffer: null,
			playbackRate: { value: 1 },
			connect: () => {},
			start: () => void started++,
			stop: () => {},
			onended: null
		});
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count, clave: '2-3' },
			voiceVolume: 1,
			quiet,
			countIn,
			onStep: () => {},
			onEnd: () => {}
		});
		await player.start();
		await vi.advanceTimersByTimeAsync(TICK_MS * 4);
		player.stop();
		return started;
	}

	it('plays no count and no clave inside it, and both outside it', async () => {
		expect(await sounded([{ from: 0, to: Infinity }])).toBe(0);
		expect(await sounded([])).toBeGreaterThan(0);
	});

	it('speaks a lead’s count-in inside it, unless the count is off', async () => {
		const countIn = [
			{ at: 0.05, n: 7 },
			{ at: 0.1, n: 8 }
		];
		expect(await sounded([{ from: 0, to: Infinity }], countIn)).toBe(2);
		expect(await sounded([{ from: 0, to: Infinity }], countIn, 'off')).toBe(0);
	});
});

describe('a routine run', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	// Ten 8-counts at 120 BPM: an 8-count every 4 s.
	const beats = Array.from({ length: 80 }, (_, i) => i * 0.5);
	const counts = beats.map((_, i) => (i % 8) + 1);
	/** Four one-eight figures from 8-count 1, slot by slot; a jump restarts at its slot. */
	const planner = (
		plan: PlanStep[],
		through: number,
		_rand: () => number,
		from?: { eight: number; slot: number }
	) => {
		const out = from ? plan.filter((s) => s.eight < from.eight) : [...plan];
		const prev = out[out.length - 1];
		let eight = from?.eight ?? (prev ? prev.eight + 1 : 1);
		let slot = from?.slot ?? (prev ? (prev.slot + 1) % 4 : 0);
		for (; eight <= through; eight++, slot = (slot + 1) % 4) {
			out.push({ eight, figureId: 100 + slot, slot });
		}
		return out;
	};

	it('reports each figure on its "1", and logs what was danced', async () => {
		const ctx = fakeBrowser();
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			planner,
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		// The clock walks with the ticks: a jump between two ticks reads as a seek.
		for (let t = 3.8; t <= 8.2; t += TICK_MS / 1000) {
			ctx.currentTime = t;
			await vi.advanceTimersByTimeAsync(TICK_MS);
		}
		expect(onStep.mock.calls.map(([step, at]) => [step.slot, at])).toEqual([
			[0, 4],
			[1, 8]
		]);
		expect(player.danced()).toEqual([100, 101]);
		player.stop();
	});

	it('jumps to a slot on the "1" of the 8-count it is in', async () => {
		const ctx = fakeBrowser();
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			planner,
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		ctx.currentTime = 9.5; // 8-count 2, its count 4
		await vi.advanceTimersByTimeAsync(TICK_MS);
		onStep.mockClear();

		player.jumpTo(3);
		expect(player.songTime()).toBeCloseTo(8);
		expect(onStep.mock.calls.map(([step, at]) => [step.slot, step.eight, at])).toEqual([[3, 2, 8]]);
		player.stop();
	});

	it('jumps while paused, and reports it at once', async () => {
		const ctx = fakeBrowser();
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			planner,
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		ctx.currentTime = 13;
		await vi.advanceTimersByTimeAsync(TICK_MS);
		player.pause();
		onStep.mockClear();

		player.jumpTo(0);
		expect(player.songTime()).toBeCloseTo(12);
		expect(onStep).toHaveBeenCalledTimes(1);
		expect(onStep.mock.calls[0][0]).toMatchObject({ slot: 0, eight: 3 });
		player.stop();
	});

	it('does nothing on a jump without a routine', async () => {
		const ctx = fakeBrowser();
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		ctx.currentTime = 9.5;
		await vi.advanceTimersByTimeAsync(TICK_MS);
		player.jumpTo(2);
		expect(player.songTime()).toBeCloseTo(9.5);
		expect(onStep).not.toHaveBeenCalled();
		player.stop();
	});
});

describe("the sound's way to the ear", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const beats = Array.from({ length: 80 }, (_, i) => i * 0.5);
	const counts = beats.map((_, i) => (i % 8) + 1);

	function song() {
		return {
			currentTime: 0,
			playbackRate: 1,
			ended: false,
			play: async () => {},
			pause() {}
		};
	}

	it('holds the count back by what the phone reports plus the correction', async () => {
		const ctx = fakeBrowser();
		Object.assign(ctx, { baseLatency: 0.01, outputLatency: 0.19 });
		const audio = song();
		const player = createPlayer({
			audio: audio as unknown as HTMLAudioElement,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			voiceVolume: 1,
			onStep: () => {},
			onEnd: () => {},
			delayCorrectionMs: 50
		});
		await player.start();
		audio.currentTime = 10;
		expect(player.songTime()).toBeCloseTo(9.75);
		expect(player.soundDelay()).toEqual({ reportedMs: 200, correctionMs: 50 });

		player.setDelayCorrection(-200);
		expect(player.songTime()).toBeCloseTo(10);
		player.stop();
	});

	it('waits in song time, so a slowed song waits fewer song seconds', async () => {
		const ctx = fakeBrowser();
		Object.assign(ctx, { outputLatency: 0.2 });
		const audio = { ...song(), playbackRate: 0.5 };
		const player = createPlayer({
			audio: audio as unknown as HTMLAudioElement,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			voiceVolume: 1,
			onStep: () => {},
			onEnd: () => {}
		});
		await player.start();
		audio.currentTime = 10;
		expect(player.songTime()).toBeCloseTo(9.9);
		player.stop();
	});

	it('shows a figure starting when its "1" is heard, not when it is played', async () => {
		const ctx = fakeBrowser();
		Object.assign(ctx, { outputLatency: 0.2 });
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			planner: (plan, through) => {
				const out = [...plan];
				for (let eight = (out.at(-1)?.eight ?? 0) + 1; eight <= through; eight++)
					out.push({ eight, figureId: 100, slot: 0 });
				return out;
			},
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		// The first figure's "1" is at 4 s; walk the clock to just past it.
		for (let t = 3.8; t <= 4.1; t += TICK_MS / 1000) {
			ctx.currentTime = t;
			await vi.advanceTimersByTimeAsync(TICK_MS);
		}
		expect(onStep).not.toHaveBeenCalled();
		for (let t = 4.1; t <= 4.3; t += TICK_MS / 1000) {
			ctx.currentTime = t;
			await vi.advanceTimersByTimeAsync(TICK_MS);
		}
		expect(onStep).toHaveBeenCalledTimes(1);
		player.stop();
	});
});

describe('a figure played but not yet heard', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const beats = Array.from({ length: 80 }, (_, i) => i * 0.5);
	const counts = beats.map((_, i) => (i % 8) + 1);

	async function playedTo(t: number) {
		const ctx = fakeBrowser();
		Object.assign(ctx, { outputLatency: 0.2 });
		const onStep = vi.fn();
		const player = createPlayer({
			audio: null,
			grid: { beats, counts },
			toggles: { count: 'off', clave: null },
			planner: (plan, through) => {
				const out = [...plan];
				for (let eight = (out.at(-1)?.eight ?? 0) + 1; eight <= through; eight++)
					out.push({ eight, figureId: 100, slot: 0 });
				return out;
			},
			voiceVolume: 1,
			onStep,
			onEnd: () => {}
		});
		await player.start();
		for (let s = 3.8; s <= t; s += TICK_MS / 1000) {
			ctx.currentTime = s;
			await vi.advanceTimersByTimeAsync(TICK_MS);
		}
		return { player, onStep };
	}

	// The first "1" is at 4 s and is heard at 4.2 s; at 4.1 s it has played, unheard.
	it('shows on a pause, rather than being lost with the queue', async () => {
		const { player, onStep } = await playedTo(4.1);
		expect(onStep).not.toHaveBeenCalled();
		player.pause();
		expect(onStep).toHaveBeenCalledTimes(1);
		player.stop();
	});

	it('shows on a change of count or clave, and only once', async () => {
		const { player, onStep } = await playedTo(4.1);
		player.setToggles({ count: 'all', clave: null });
		expect(onStep).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(onStep).toHaveBeenCalledTimes(1);
		player.stop();
	});
});
