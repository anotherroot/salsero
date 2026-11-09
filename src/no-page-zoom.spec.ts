import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The page never zooms, as a native screen doesn't: no pinch, no double tap.
 * The pictures that zoom (a video, the positions map) take their own touches
 * (`touch-none`) and zoom inside themselves.
 */
describe('no page zoom', () => {
	it('the viewport cannot be scaled', () => {
		const app = readFileSync('src/app.html', 'utf8');
		const viewport = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(app)?.[1] ?? '';
		expect(viewport).toContain('maximum-scale=1');
		expect(viewport).toContain('user-scalable=no');
		expect(viewport).toContain('viewport-fit=cover');
	});

	it('the page pans but never pinches, where the meta is ignored (iOS)', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		expect(css).toMatch(/html\s*\{[^}]*touch-action:\s*pan-x pan-y;/);
	});
});
