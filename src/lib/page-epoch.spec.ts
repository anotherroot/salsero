import { parse } from 'devalue';
import { describe, expect, it } from 'vitest';
import {
	PAGE_EPOCH,
	STALE_HEADER,
	STALE_MESSAGE,
	fillEpoch,
	holdsBack,
	staleAnswer,
	staleEpoch,
	staleFailure,
	staleMove
} from './page-epoch';

describe('staleEpoch', () => {
	it('never refuses a request without the header', () => {
		expect(staleEpoch(null, 2)).toBe(false);
	});

	it('refuses an older page', () => {
		expect(staleEpoch('1', 2)).toBe(true);
	});

	it('lets the same page and a newer one through', () => {
		expect(staleEpoch('2', 2)).toBe(false);
		expect(staleEpoch('3', 2)).toBe(false);
	});

	it('lets anything that is not a whole number through', () => {
		expect(staleEpoch('x', 2)).toBe(false);
		expect(staleEpoch('', 2)).toBe(false);
		expect(staleEpoch('1.5', 2)).toBe(false);
		expect(staleEpoch('%salsa.epoch%', 2)).toBe(false);
	});

	it('starts at 1, so the current page is never stale', () => {
		expect(PAGE_EPOCH).toBeGreaterThanOrEqual(1);
		expect(staleEpoch(String(PAGE_EPOCH), PAGE_EPOCH)).toBe(false);
	});
});

describe('fillEpoch', () => {
	it('writes the epoch into the page for the fetch wrapper', () => {
		expect(fillEpoch('<html data-page-epoch="%salsa.epoch%">')).toBe(
			`<html data-page-epoch="${PAGE_EPOCH}">`
		);
	});

	it('leaves a chunk without the placeholder alone', () => {
		expect(fillEpoch('<p>hi</p>')).toBe('<p>hi</p>');
	});
});

describe('staleAnswer', () => {
	it('is a 409 with the marker', async () => {
		const res = staleAnswer(false);
		expect(res.status).toBe(409);
		expect(res.headers.get(STALE_HEADER)).toBe('1');
		// JSON, so SvelteKit's data load carries the words to the error page (`errorView`).
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(await res.json()).toBe(STALE_MESSAGE);
	});

	it('answers a form action as a failure the form shows, so the page and what was typed stay', async () => {
		const res = staleAnswer(true);
		expect(res.status).toBe(409);
		expect(res.headers.get(STALE_HEADER)).toBe('1');
		expect(res.headers.get('content-type')).toContain('application/json');
		// What `deserialize` in `$app/forms` does with it.
		const body = JSON.parse(await res.text());
		expect(body.type).toBe('failure');
		expect(body.status).toBe(409);
		expect(parse(body.data)).toEqual({ message: STALE_MESSAGE });
	});
});

const QUIET = { playerOpen: false, sheetsOpen: false, unsaved: 0, held: 0 };

describe('staleMove', () => {
	const here = { routeId: '/[dance]', navigating: false, sending: 0, ...QUIET };

	it('reloads a quiet page', () => {
		expect(staleMove(here)).toBe('reload');
	});

	it('shows the bar over anything a reload would lose', () => {
		expect(staleMove({ ...here, unsaved: 1 })).toBe('bar');
		expect(staleMove({ ...here, sheetsOpen: true })).toBe('bar');
		expect(staleMove({ ...here, playerOpen: true })).toBe('bar');
		expect(staleMove({ ...here, held: 1 })).toBe('bar');
	});

	it('never reloads over a form whose save is out: the refused save is still to be asked about', () => {
		// `use:guarded` counts a form as clean while it sends, and the answer
		// arrives before the form hears it.
		expect(staleMove({ ...here, sending: 1 })).toBe('bar');
	});

	it('never reloads Practice or My count by itself', () => {
		expect(staleMove({ ...here, routeId: '/[dance]/player' })).toBe('bar');
		expect(staleMove({ ...here, routeId: '/voice' })).toBe('bar');
	});

	it('loads the page a navigation was heading for: the guard already let it go', () => {
		expect(staleMove({ ...here, navigating: true })).toBe('go');
		expect(staleMove({ ...here, navigating: true, unsaved: 1, sheetsOpen: true })).toBe('go');
	});

	it('does not cut an upload or a run short for a navigation either', () => {
		expect(staleMove({ ...here, navigating: true, held: 1 })).toBe('bar');
	});
});

describe('holdsBack', () => {
	const page = 'https://salsa.example/salsa/figures/3';

	it('holds every answer back while the page is going away, so nothing flashes', () => {
		expect(holdsBack('reload', 'https://salsa.example/api/video-spots', page)).toBe(true);
		expect(holdsBack('go', 'https://salsa.example/salsa/moves/__data.json', page)).toBe(true);
	});

	it('holds back a data reload of this page: its error would replace the page', () => {
		expect(
			holdsBack(
				'bar',
				'https://salsa.example/salsa/figures/3/__data.json?x-sveltekit-invalidated=01',
				page
			)
		).toBe(true);
		expect(holdsBack('bar', 'https://salsa.example/__data.json', 'https://salsa.example/')).toBe(
			true
		);
	});

	it('hands back the rest while the page stays: API callers show their own failure', () => {
		expect(holdsBack('bar', 'https://salsa.example/api/video-spots', page)).toBe(false);
		// A preload of another page: held back, the tap that follows would wait forever on it.
		expect(holdsBack('bar', 'https://salsa.example/salsa/moves/__data.json', page)).toBe(false);
		// A form action: its answer is a failure the form shows.
		expect(holdsBack('bar', 'https://salsa.example/salsa/figures/3?/save', page)).toBe(false);
	});
});

describe('staleFailure', () => {
	it('tells the refusal of a stale page from any other failure', () => {
		const refused = { type: 'failure', status: 409, data: { message: STALE_MESSAGE } } as const;
		expect(staleFailure(refused)).toBe(true);
		expect(staleFailure({ type: 'failure', status: 409, data: { message: 'In use.' } })).toBe(
			false
		);
		expect(staleFailure({ type: 'failure', status: 400, data: { message: STALE_MESSAGE } })).toBe(
			false
		);
		expect(staleFailure({ type: 'success', status: 200 })).toBe(false);
	});
});
