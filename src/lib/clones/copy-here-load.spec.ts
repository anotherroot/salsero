import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CopyHereView } from '$lib/types';
import { CopyHereLoad } from './copy-here-load.svelte';

const VIEW: CopyHereView = {
	goes: 'Just the figure',
	bytes: 0,
	already: [],
	twins: [
		{
			gene: 'g1',
			kind: 'figure',
			label: 'Cradle entry · Basic',
			from: 1,
			choices: [
				{ id: 1, place: { kind: 'mine' }, changedAt: 0, meta: '' },
				{ id: 2, place: { kind: 'team', teamId: 4, name: 'Sreda' }, changedAt: 0, meta: '' }
			]
		}
	],
	staysBehind: 0,
	usedBytes: 0,
	limitBytes: 100
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
	fetchMock = vi.fn(async () => new Response(JSON.stringify(VIEW)));
	vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('CopyHereLoad', () => {
	it('loads the plan and starts each twin question on its own row', async () => {
		const l = new CopyHereLoad();
		await l.load('figure', 1, 7);
		expect(String(fetchMock.mock.calls[0][0])).toBe('/api/clones/copy?kind=figure&id=1&into=7');
		expect(l.view?.goes).toBe('Just the figure');
		expect(l.use).toEqual({ g1: 1 });
	});

	it('a page refresh asking for the same plan keeps the answers and asks nothing (review M6)', async () => {
		const l = new CopyHereLoad();
		await l.load('figure', 1, 7);
		l.use = { g1: 2 };
		await l.load('figure', 1, 7);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(l.use).toEqual({ g1: 2 });
	});

	it('a failed load says so', async () => {
		fetchMock.mockImplementation(async () => new Response('', { status: 404 }));
		const l = new CopyHereLoad();
		await l.load('figure', 1, 7);
		expect(l.failed).toBe(true);
		expect(l.view).toBeNull();
	});
});
