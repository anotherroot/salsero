import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Tapping a choice low in a scrolled sheet turned the sheet black: the choice's
 * hidden radio sat outside the scrolling body, and focusing it scrolled the
 * sheet itself (overflow: hidden still scrolls by focus) off screen. Two guards.
 */
const read = (f: string) => readFileSync(f, 'utf8');

describe('a sheet never scrolls as a whole', () => {
	it('the sheet clips rather than hides its overflow', () => {
		const style = read('src/lib/components/ui/Sheet.svelte').split('<style>')[1];
		const dialog = style.slice(style.indexOf('dialog {'), style.indexOf('}'));
		expect(dialog).toContain('overflow: clip;');
		expect(dialog).not.toContain('overflow: hidden');
	});

	it('the player’s sheet panel clips too', () => {
		const panel = read('src/lib/components/ui/PlayerLayer.svelte')
			.split('\n')
			.find((l) => l.includes('sheet-panel'));
		expect(panel).toContain('overflow-clip');
		expect(panel).not.toContain('overflow-hidden');
	});

	it('a label holding a hidden input is the input’s containing block', () => {
		expect(read('src/routes/layout.css')).toMatch(
			/@layer base \{\s*label:has\(input\.sr-only\) \{\s*position: relative;/
		);
	});
});
