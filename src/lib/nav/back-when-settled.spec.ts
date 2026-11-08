import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `backWhenSettled` (trail.svelte.ts) run against a stand-in router: the sheets'
 * Back has landed at once, and the trail is empty, so there is no history step
 * to take and the fallback is where back goes. A save outside a run on the
 * desktop (a pane page has no opener) lands here: the
 * fallback must take the saved page's entry, or browser Back returns to it.
 */
const nav = vi.hoisted(() => ({ goto: vi.fn(async () => {}) }));

vi.mock('$app/navigation', () => ({
	goto: nav.goto,
	afterNavigate: () => {},
	beforeNavigate: () => {},
	onNavigate: () => {}
}));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/salsa/exercises/27') } }));
vi.mock('$lib/sheets/history.svelte', () => ({
	whenSettled: (fn: () => void) => fn(),
	gotoWhenSettled: async () => {}
}));

import { backWhenSettled } from './trail.svelte';

const TODAY = { href: '/salsa', label: 'Back to Today' };

beforeEach(() => {
	nav.goto.mockClear();
	vi.stubGlobal('location', { pathname: '/salsa/exercises/27', search: '' });
	vi.stubGlobal('history', { state: null, back: vi.fn() });
	vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} });
});

describe('backWhenSettled with no history step', () => {
	it('replaces the page with the fallback when asked', async () => {
		await backWhenSettled(TODAY, { replace: true });
		expect(nav.goto).toHaveBeenCalledWith('/salsa', { replaceState: true });
		expect(history.back).not.toHaveBeenCalled();
	});

	it('pushes the fallback by default, as the band back does', async () => {
		await backWhenSettled(TODAY);
		expect(nav.goto).toHaveBeenCalledWith('/salsa', { replaceState: false });
	});
});
