import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALIASES, FILLED, ICONS, type IconName } from './icons';

/** The names in kit.py's ICONS table: the board the icon set was ported from. */
function kitNames(): string[] {
	const src = readFileSync('docs/superpowers/design-kit/kit.py', 'utf8');
	const table = src.slice(src.indexOf('ICONS = {'));
	const body = table.slice(0, table.search(/^\}/m));
	return [...body.matchAll(/^\s+'([a-z0-9-]+)':/gm)].map((m) => m[1]);
}

describe('icons', () => {
	it('every icon has markup with no hard-coded colour', () => {
		for (const [name, markup] of Object.entries(ICONS)) {
			expect(markup, name).not.toBe('');
			expect(markup, name).not.toContain('fill="#');
			expect(markup, name).not.toContain('stroke="#');
		}
	});
	it('covers every kit icon and every alias', () => {
		for (const alias of Object.keys(ALIASES)) expect(ICONS[alias as IconName], alias).toBeTruthy();
		expect(kitNames().length).toBeGreaterThan(60);
		for (const name of kitNames()) expect(ICONS[name as IconName], name).toBeTruthy();
	});
	it('no two canonical icons draw the same thing', () => {
		const canonical = Object.keys(ICONS).filter((n) => !(n in ALIASES));
		expect(canonical.length).toBe(new Set(Object.values(ICONS)).size);
	});
	it('filled variants cover the four tabs and are real icons', () => {
		for (const n of ['today', 'moves', 'lessons', 'group', 'music'])
			expect(FILLED[n as IconName], n).toBeTruthy();
		for (const name of Object.keys(FILLED)) expect(name in ICONS, name).toBe(true);
	});
	it('an alias renders its canonical markup', () => {
		expect(ICONS.today).toBe(ICONS.calendar);
		expect(FILLED.today).toBe(FILLED.calendar);
	});
});
