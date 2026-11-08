import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { transform } from 'esbuild';

/*
 * The page clock is about effects and the page's visibility, and the vitest
 * project compiles for the server, where $effect never runs. So the module is
 * compiled here for the client (types stripped, `svelte` pointed at the client
 * runtime, as chrome.spec.ts does) and run against a stand-in `document`.
 * The time is never typed: these minutes are what Done saves.
 */
const DIR = join(process.cwd(), '.svelte-kit', 'page-clock-spec');
const CLIENT = 'svelte/internal/client';

async function build(name: string, source: string) {
	const js = (await transform(source, { loader: 'ts' })).code;
	const out = compileModule(js, { generate: 'client', filename: name })
		.js.code.replace(/from ['"]svelte['"]/g, `from '${CLIENT}'`)
		.replace(/from ['"]\$lib\/exercises\/stopwatch['"]/g, `from './stopwatch.js'`);
	writeFileSync(join(DIR, name), out);
}

class FakeDocument extends EventTarget {
	visibilityState: 'visible' | 'hidden' = 'visible';
	show(visible: boolean) {
		this.visibilityState = visible ? 'visible' : 'hidden';
		this.dispatchEvent(new Event('visibilitychange'));
	}
}

let flush: () => void;
type Clock = {
	readonly seconds: number;
	readonly watch: { bankedMs: number; runningSince: number | null };
	restart(): void;
	carry(watch: { bankedMs: number; runningSince: number | null }): void;
};
let pageClock: (carried?: { bankedMs: number; runningSince: number | null } | null) => Clock;
let root: (setup: () => void) => () => void;
let doc: FakeDocument;

beforeAll(async () => {
	rmSync(DIR, { recursive: true, force: true });
	mkdirSync(DIR, { recursive: true });
	writeFileSync(
		join(DIR, 'stopwatch.js'),
		(await transform(readFileSync(join(__dirname, 'stopwatch.ts'), 'utf8'), { loader: 'ts' })).code
	);
	await build('page-clock.js', readFileSync(join(__dirname, 'page-clock.svelte.ts'), 'utf8'));
	await build('harness.js', 'export const root = (setup) => $effect.root(setup);');
	({ flush } = await import(/* @vite-ignore */ CLIENT));
	({ pageClock } = await import(/* @vite-ignore */ pathToFileURL(join(DIR, 'page-clock.js')).href));
	({ root } = await import(/* @vite-ignore */ pathToFileURL(join(DIR, 'harness.js')).href));
});
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

beforeEach(() => {
	vi.useFakeTimers({ now: 1_700_000_000_000 });
	doc = new FakeDocument();
	vi.stubGlobal('document', doc);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function mount(carried: { bankedMs: number; runningSince: number | null } | null = null): {
	clock: Clock;
	stop: () => void;
} {
	let clock!: Clock;
	const stop = root(() => {
		clock = pageClock(carried);
	});
	flush();
	return { clock, stop };
}

describe('pageClock', () => {
	it('goes on from the time a trip to the player brought back', () => {
		const { clock, stop } = mount({ bankedMs: 600_000, runningSince: null });
		expect(clock.seconds).toBe(600);
		vi.advanceTimersByTime(5_000);
		expect(clock.seconds).toBe(605);
		clock.restart();
		expect(clock.seconds).toBe(0);
		stop();
	});

	it('carries a trip’s time brought back after it mounted (back from the player)', () => {
		const { clock, stop } = mount();
		vi.advanceTimersByTime(2_000);
		clock.carry({ bankedMs: 600_000, runningSince: null });
		expect(clock.seconds).toBe(600);
		vi.advanceTimersByTime(5_000);
		expect(clock.seconds).toBe(605);
		stop();
	});

	it('hands out its watch, for the trip to the player', () => {
		const { clock, stop } = mount();
		vi.advanceTimersByTime(5_000);
		expect(clock.watch).toEqual({ bankedMs: 0, runningSince: 1_700_000_000_000 });
		stop();
	});

	it('counts the seconds since the page opened', () => {
		const { clock, stop } = mount();
		expect(clock.seconds).toBe(0);
		vi.advanceTimersByTime(5_000);
		expect(clock.seconds).toBe(5);
		stop();
	});

	it('does not count while the page is hidden (a locked phone, another tab)', () => {
		const { clock, stop } = mount();
		vi.advanceTimersByTime(5_000);
		doc.show(false);
		vi.advanceTimersByTime(9 * 3600_000);
		expect(clock.seconds).toBe(5);
		doc.show(true);
		vi.advanceTimersByTime(3_000);
		expect(clock.seconds).toBe(8);
		stop();
	});

	it('ticks only while visible', () => {
		const { stop } = mount();
		expect(vi.getTimerCount()).toBe(1);
		doc.show(false);
		expect(vi.getTimerCount()).toBe(0);
		doc.show(true);
		expect(vi.getTimerCount()).toBe(1);
		stop();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('a page opened hidden starts counting once it shows', () => {
		doc.visibilityState = 'hidden';
		const { clock, stop } = mount();
		vi.advanceTimersByTime(60_000);
		expect(clock.seconds).toBe(0);
		doc.show(true);
		vi.advanceTimersByTime(2_000);
		expect(clock.seconds).toBe(2);
		stop();
	});

	it('restart counts again from 0 (another exercise opened in the page)', () => {
		const { clock, stop } = mount();
		vi.advanceTimersByTime(40_000);
		clock.restart();
		expect(clock.seconds).toBe(0);
		vi.advanceTimersByTime(2_000);
		expect(clock.seconds).toBe(2);
		stop();
	});

	it('stops listening once the page is gone', () => {
		const { clock, stop } = mount();
		vi.advanceTimersByTime(4_000);
		stop();
		doc.show(false);
		doc.show(true);
		expect(clock.seconds).toBeGreaterThanOrEqual(4);
		expect(vi.getTimerCount()).toBe(0);
	});
});
