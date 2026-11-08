import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { transform } from 'esbuild';

/*
 * chrome.svelte.ts is about effects, and the vitest project compiles for the
 * server, where $effect never runs. So the module is compiled here for the
 * client (types stripped, `svelte` pointed at the client runtime) and run
 * without a DOM. The bug this guards: `claims++` inside the effect read and
 * wrote `claims`, so every claim threw effect_update_depth_exceeded.
 */
const DIR = join(process.cwd(), '.svelte-kit', 'chrome-spec');
const CLIENT = 'svelte/internal/client';

const HARNESS = `
export function flag(initial) {
	let value = $state(initial);
	return { get value() { return value; }, set value(v) { value = v; } };
}
export const root = (setup) => $effect.root(setup);
`;

async function build(name: string, source: string) {
	const js = (await transform(source, { loader: 'ts' })).code;
	const out = compileModule(js, { generate: 'client', filename: name }).js.code.replace(
		/from ['"]svelte['"]/g,
		`from '${CLIENT}'`
	);
	writeFileSync(join(DIR, name), out);
}

let flushSync: () => void;
let bottom: { readonly claimed: boolean };
let claimBottom: (active: () => boolean) => void;
let pinned: { readonly bar: boolean };
let pinBar: () => void;
let flag: (v: boolean) => { value: boolean };
let root: (setup: () => void) => () => void;

beforeAll(async () => {
	rmSync(DIR, { recursive: true, force: true });
	mkdirSync(DIR, { recursive: true });
	await build('chrome.js', readFileSync(join(__dirname, 'chrome.svelte.ts'), 'utf8'));
	await build('harness.js', HARNESS);
	({ flush: flushSync } = await import(/* @vite-ignore */ CLIENT));
	({ bottom, claimBottom, pinned, pinBar } = await import(
		/* @vite-ignore */ pathToFileURL(join(DIR, 'chrome.js')).href
	));
	({ flag, root } = await import(/* @vite-ignore */ pathToFileURL(join(DIR, 'harness.js')).href));
});
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe('claimBottom', () => {
	it('holds the bottom while active, and releases on false and on destroy', () => {
		const active = flag(false);
		const stop = root(() => claimBottom(() => active.value));
		flushSync();
		expect(bottom.claimed).toBe(false);
		active.value = true;
		flushSync();
		expect(bottom.claimed).toBe(true);
		active.value = false;
		flushSync();
		expect(bottom.claimed).toBe(false);
		active.value = true;
		flushSync();
		expect(bottom.claimed).toBe(true);
		stop();
		flushSync();
		expect(bottom.claimed).toBe(false);
	});

	it('releases two claims independently', () => {
		const a = flag(true);
		const stopA = root(() => claimBottom(() => a.value));
		const stopB = root(() => claimBottom(() => true));
		flushSync();
		expect(bottom.claimed).toBe(true);
		a.value = false;
		flushSync();
		expect(bottom.claimed).toBe(true);
		stopB();
		flushSync();
		expect(bottom.claimed).toBe(false);
		stopA();
	});
});

describe('pinBar', () => {
	it('says a bar is pinned while one is mounted', () => {
		expect(pinned.bar).toBe(false);
		const stopA = root(() => pinBar());
		const stopB = root(() => pinBar());
		flushSync();
		expect(pinned.bar).toBe(true);
		stopA();
		flushSync();
		expect(pinned.bar).toBe(true);
		stopB();
		flushSync();
		expect(pinned.bar).toBe(false);
	});
});
