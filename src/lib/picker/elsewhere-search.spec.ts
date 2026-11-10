import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElsewherePlace } from '$lib/types';
import { DEBOUNCE_MS, ElsewhereSearch } from './elsewhere-search.svelte';

const MINE: ElsewherePlace[] = [
	{
		place: { kind: 'mine' },
		readOnly: false,
		rows: [
			{
				kind: 'figure',
				id: 1,
				label: 'Cradle entry · Basic',
				heading: 'Cradle entry',
				short: 'Basic',
				alsoIn: [],
				restore: null,
				sameName: null
			}
		]
	}
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	fetchMock = vi.fn(async () => new Response(JSON.stringify(MINE)));
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('ElsewhereSearch', () => {
	it('asks once the typing pauses, for the latest text', async () => {
		const s = new ElsewhereSearch();
		s.search(7, ['figure'], 'cr');
		s.search(7, ['figure'], 'cradle');
		expect(s.state).toBe('loading');
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0][0])).toBe('/api/elsewhere?into=7&kinds=figure&q=cradle');
		expect(s.state).toBe('ready');
		expect(s.groups.map((g) => g.title)).toEqual(['Yours']);
	});

	it('an empty search clears at once, asking nothing', () => {
		const s = new ElsewhereSearch();
		s.search(7, ['figure'], '  ');
		expect(s.state).toBe('ready');
		expect(s.places).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('offline, or a failed answer, says other places need a connection', async () => {
		vi.stubGlobal('navigator', { onLine: false });
		const s = new ElsewhereSearch();
		s.search(7, ['figure'], 'cradle');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(s.state).toBe('offline');
		expect(fetchMock).not.toHaveBeenCalled();

		vi.stubGlobal('navigator', { onLine: true });
		fetchMock.mockImplementation(async () => new Response('', { status: 500 }));
		s.refresh();
		await vi.advanceTimersByTimeAsync(0);
		expect(s.state).toBe('offline');
	});
});
