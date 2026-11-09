import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { transform } from 'esbuild';

/*
 * The run's song lives on the grid this loads: while it is there, the page
 * keeps its <audio>. A page load that runs again during a run (a practice
 * saved, the device's pull) hands the same song back; that must not drop the
 * grid, or the <audio> the run plays on is swapped for a new one at 0:00.
 * Compiled for the client, as page-clock.spec.ts does: $effect never runs on
 * the server.
 */
const DIR = join(process.cwd(), '.svelte-kit', 'song-grid-spec');
const CLIENT = 'svelte/internal/client';

async function build(name: string, source: string) {
	const js = (await transform(source, { loader: 'ts' })).code;
	const out = compileModule(js, { generate: 'client', filename: name })
		.js.code.replace(/from ['"]svelte['"]/g, `from '${CLIENT}'`)
		.replace(/from ['"]\$lib\/i18n\/catalog['"]/g, `from './catalog.js'`);
	writeFileSync(join(DIR, name), out);
}

type Grid = { grid: unknown; error: string | null };
type Mounted = { s: { data: { slug: string }; id: number | null }; grid: Grid; stop: () => void };
let flush: () => void;
let mount: () => Mounted;

beforeAll(async () => {
	rmSync(DIR, { recursive: true, force: true });
	mkdirSync(DIR, { recursive: true });
	writeFileSync(
		join(DIR, 'catalog.js'),
		"export const t = () => ({ player: { songFailed: 'failed' } });"
	);
	await build('songGrid.js', readFileSync(join(__dirname, 'songGrid.svelte.ts'), 'utf8'));
	await build(
		'harness.js',
		`import { loadSongGrid } from './songGrid.js';
		export function mount() {
			const s = $state({ data: { slug: 'salsa' }, id: 5 });
			let grid;
			const stop = $effect.root(() => {
				grid = loadSongGrid(() => s.data.slug, () => s.id);
			});
			return { s, grid, stop };
		}`
	);
	({ flush } = await import(/* @vite-ignore */ CLIENT));
	({ mount } = await import(/* @vite-ignore */ pathToFileURL(join(DIR, 'harness.js')).href));
});
afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
	vi.unstubAllGlobals();
});

const settle = async () => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
	flush();
};

describe('loadSongGrid', () => {
	it('keeps the grid when the page loads again with the same song', async () => {
		const fetchGrid = vi.fn(async (url: string) => ({
			ok: true,
			json: async () => ({ url })
		}));
		vi.stubGlobal('fetch', fetchGrid);
		const m = mount();
		flush();
		await settle();
		const first = m.grid.grid;
		expect(first).toEqual({ url: '/salsa/songs/5/grid' });

		// A load ran again: a new data object, the same dance and song.
		m.s.data = { slug: 'salsa' };
		flush();
		await settle();
		expect(m.grid.grid).toBe(first);
		expect(fetchGrid).toHaveBeenCalledTimes(1);

		// Another song is another grid.
		m.s.id = 6;
		flush();
		expect(m.grid.grid).toBeNull();
		await settle();
		expect(m.grid.grid).toEqual({ url: '/salsa/songs/6/grid' });
		m.stop();
	});
});
