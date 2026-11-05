import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { frameOf, PAGE_WIDTH, sideLit } from './frame';

describe('frameOf', () => {
	it('gives each kind of route its frame', () => {
		expect(frameOf('/[dance]/figures/[id]', true)).toBe('side');
		expect(frameOf('/[dance]', true)).toBe('side');
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

	it('knows a frame for every page route but the dev kit', () => {
		for (const file of globSync('src/routes/**/+page.svelte')) {
			const id =
				'/' +
				file
					.replace(/^src\/routes\//, '')
					.replace(/\/?\+page\.svelte$/, '')
					.replace(/\/$/, '');
			if (id === '/dev/kit') continue;
			expect(frameOf(id === '/' ? '/' : id, true), id).not.toBe('none');
		}
	});
});

describe('sideLit', () => {
	it('lights a tab, Settings, or nothing', () => {
		expect(sideLit('/salsa/figures/3', 'salsa')).toBe('moves');
		expect(sideLit('/settings/storage', 'salsa')).toBe('settings');
		expect(sideLit('/settings', 'salsa')).toBe('settings');
		expect(sideLit('/voice', 'salsa')).toBe('settings');
		expect(sideLit('/admin', 'salsa')).toBe('settings');
		expect(sideLit('/bachata', 'salsa')).toBeNull();
	});
});

describe('PAGE_WIDTH', () => {
	it("is the spec's content widths", () => {
		expect(PAGE_WIDTH).toEqual({ one: 720, two: 1140, song: 640, narrow: 560 });
	});
});
