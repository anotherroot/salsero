import { describe, expect, it } from 'vitest';
import { ALIASES, FILLED, ICONS, type IconName } from './icons';

describe('icons', () => {
	it('every icon has markup with no hard-coded colour', () => {
		for (const [name, markup] of Object.entries(ICONS)) {
			expect(markup, name).not.toBe('');
			expect(markup, name).not.toContain('fill="#');
			expect(markup, name).not.toContain('stroke="#');
		}
	});
	it('covers the kit names and every alias', () => {
		for (const alias of Object.keys(ALIASES)) expect(ICONS[alias as IconName], alias).toBeTruthy();
		expect(Object.keys(ICONS).length).toBeGreaterThanOrEqual(72);
	});
	it('filled variants cover the four tabs and are real icons', () => {
		for (const n of ['today', 'moves', 'lessons', 'music'])
			expect(FILLED[n as IconName], n).toBeTruthy();
		for (const name of Object.keys(FILLED)) expect(name in ICONS, name).toBe(true);
	});
	it('an alias renders its canonical markup', () => {
		expect(ICONS.today).toBe(ICONS.calendar);
		expect(FILLED.today).toBe(FILLED.calendar);
	});
});
