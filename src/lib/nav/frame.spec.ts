import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { frameNow, frameOf, frameOfError, PAGE_WIDTH, sideLit } from './frame';

describe('frameOf', () => {
	it('gives each kind of route its frame', () => {
		expect(frameOf('/[dance]/(moves)/figures/[id]', true)).toBe('side');
		expect(frameOf('/[dance]/(today)', true)).toBe('side');
		expect(frameOf('/[dance]/(today)/exercises/[id]', true)).toBe('side');
		expect(frameOf('/[dance]/player', true)).toBe('bare');
		expect(frameOf('/[dance]/share', true)).toBe('bare');
		expect(frameOf('/login', false)).toBe('card');
		expect(frameOf('/g/[code]', true)).toBe('card');
		expect(frameOf('/settings/storage', true)).toBe('side');
		expect(frameOf('/admin', true)).toBe('side');
		expect(frameOf('/voice', true)).toBe('side');
		expect(frameOf('/dev/kit', true)).toBe('none');
		expect(frameOf(null, true)).toBe('none');
	});

	// The shell (offline phase 2) is never drawn as itself: the client draws the page at its URL.
	it('knows a frame for every page route but the dev kit and the shell', () => {
		for (const file of globSync('src/routes/**/+page.svelte')) {
			const id =
				'/' +
				file
					.replace(/^src\/routes\//, '')
					.replace(/\/?\+page\.svelte$/, '')
					.replace(/\/$/, '');
			if (id === '/dev/kit' || id === '/shell') continue;
			expect(frameOf(id === '/' ? '/' : id, true), id).not.toBe('none');
		}
	});
});

describe('frameOfError', () => {
	it('keeps the side for an error inside a dance, by the path asked for (a 404 has no route)', () => {
		expect(frameOfError('/salsa/does-not-exist', true)).toBe('side');
		expect(frameOfError('/salsa/figures/999', true)).toBe('side');
		expect(frameOfError('/bachata', true)).toBe('side');
		// Practice and share have no side, but their errors keep the frame (desktop spec).
		expect(frameOfError('/salsa/player', true)).toBe('side');
		expect(frameOfError('/settings/storage', true)).toBe('side');
	});

	it('puts every other error in the card: outside a dance, or signed out', () => {
		expect(frameOfError('/g/OLDCODE', true)).toBe('card');
		expect(frameOfError('/settings/nope', true)).toBe('card');
		expect(frameOfError('/nope', true)).toBe('card');
		expect(frameOfError('/salsaxyz', true)).toBe('card');
		expect(frameOfError('/join', false)).toBe('card');
		expect(frameOfError('/salsa/figures/1', false)).toBe('card');
	});
});

describe('frameNow', () => {
	const figure = {
		routeId: '/[dance]/(moves)/figures/[id]',
		path: '/salsa/figures/3',
		error: false
	};
	const missing = { routeId: null, path: '/salsa/does-not-exist', error: true };

	it("is the page's own frame while nothing is under way", () => {
		expect(frameNow(figure, undefined, false, true)).toBe('side');
		const login = { routeId: '/login', path: '/login', error: false };
		expect(frameNow(login, undefined, false, false)).toBe('card');
	});

	it("keeps the page's frame while a navigation waits without the skeleton", () => {
		// Practice, a card page, a path with no route: the old page must not reflow under them.
		expect(frameNow(figure, '/[dance]/player', false, true)).toBe('side');
		expect(frameNow(figure, '/app', false, true)).toBe('side');
		expect(frameNow(figure, null, false, true)).toBe('side');
	});

	it("takes the destination's frame once the skeleton covers the page", () => {
		expect(frameNow(figure, '/[dance]/player', true, true)).toBe('bare');
		expect(frameNow(figure, '/app', true, true)).toBe('card');
	});

	it('judges an error page by the path asked for, until the skeleton covers it', () => {
		expect(frameNow(missing, undefined, false, true)).toBe('side');
		expect(frameNow(missing, '/[dance]/player', false, true)).toBe('side');
		expect(frameNow({ ...missing, path: '/nope' }, undefined, false, true)).toBe('card');
		expect(frameNow(missing, '/[dance]/player', true, true)).toBe('bare');
	});
});

describe('sideLit', () => {
	it('lights a tab, Settings, or nothing', () => {
		expect(sideLit('/salsa/figures/3', 'salsa')).toBe('moves');
		expect(sideLit('/settings/storage', 'salsa')).toBe('settings');
		expect(sideLit('/settings', 'salsa')).toBe('settings');
		expect(sideLit('/voice', 'salsa')).toBe('settings');
		expect(sideLit('/admin', 'salsa')).toBe('settings');
		// The side has no You: the You page's settings are Settings'.
		expect(sideLit('/salsa/you', 'salsa')).toBe('settings');
		expect(sideLit('/bachata', 'salsa')).toBeNull();
	});
});

describe('PAGE_WIDTH', () => {
	it("is the spec's content widths", () => {
		expect(PAGE_WIDTH).toEqual({ one: 720, two: 1140, song: 640, narrow: 560 });
	});
});
