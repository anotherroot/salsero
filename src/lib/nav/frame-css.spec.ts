import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The frame's CSS (desktop spec, "The sheet" and "Pages without the side"): what
 * vitest can check of it. The phone itself is checked by the screenshot rig.
 */
const css = readFileSync('src/routes/layout.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of every rule whose selector list is exactly `selector`, at any depth. */
function rules(selector: string): string[] {
	const out: string[] = [];
	const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
	for (const m of css.matchAll(new RegExp(`(?:^|[}{;])\\s*${esc}\\s*\\{([^}]*)\\}`, 'g')))
		out.push(m[1]);
	return out;
}

/** The text of the `@media (width >= 1024px)` blocks. */
function deskBlocks(): string {
	let out = '';
	let at = css.indexOf('@media (width >= 1024px)');
	while (at >= 0) {
		let depth = 0;
		let i = css.indexOf('{', at);
		const start = i;
		for (; i < css.length; i++) {
			if (css[i] === '{') depth++;
			else if (css[i] === '}' && --depth === 0) break;
		}
		out += css.slice(start, i + 1);
		at = css.indexOf('@media (width >= 1024px)', i);
	}
	return out;
}

describe('the frame in layout.css', () => {
	it('zeroes the side for frames without one, recomputing the pane edge too', () => {
		const sel = "[data-frame='bare'],\n[data-frame='card'],\n[data-frame='none']";
		const body = rules(sel).join('');
		expect(body).toMatch(/--side-w:\s*0px/);
		expect(body).toMatch(/--pane-left:\s*0px/);
	});

	it('gives the tab bar room on the phone and none on the desk', () => {
		expect(rules(':root').join('')).toMatch(
			/--tab-bar-space:\s*calc\(var\(--tab-bar-h\) \+ var\(--safe-bottom\)\)/
		);
		expect(deskBlocks()).toMatch(/--tab-bar-space:\s*0px/);
	});

	it('lets the frame’s band through body only on the desk, and only around a frame', () => {
		const sel = "body:has([data-frame='side'], [data-frame='bare'])";
		// Once, inside the desk block: the phone's body keeps its ground.
		expect(css.split(sel)).toHaveLength(2);
		expect(deskBlocks()).toMatch(
			/body:has\(\[data-frame='side'\], \[data-frame='bare'\]\)\s*\{\s*background:\s*transparent/
		);
	});
});
