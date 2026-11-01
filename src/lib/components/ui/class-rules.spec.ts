import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Tailwind 4 orders utilities in its own stylesheet order, so a colour class
// added after a builder's output can lose to the builder's own. Colours come
// from the builder (iconButton(variant, tone), FIELD_INVALID, SELECT_INVALID).

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		if (e.isDirectory()) return walk(p);
		if (!/\.(svelte|ts)$/.test(e.name) || /\.spec\.ts$/.test(e.name) || e.name === 'styles.ts')
			return [];
		return [p];
	});
}

const files = walk('src').map((f) => ({ f, lines: readFileSync(f, 'utf8').split('\n') }));

// A walk that finds nothing would pass every scan below.
if (files.length < 200) throw new Error(`class-rules scan found only ${files.length} files`);

function hits(test: (line: string) => boolean): string[] {
	return files.flatMap(({ f, lines }) =>
		lines.flatMap((l, i) => (test(l) ? [`${f}:${i + 1}: ${l.trim()}`] : []))
	);
}

const COLOUR =
	'text-(ink|ink-2|muted|accent|accent-text|danger|done|warn|status|on-accent|chevron)';

// Reason a bare `text-accent` on a line with text styling is fine: 'file:substring' -> why.
const ICON_ONLY: Record<string, string> = {};

describe('class rules', () => {
	it('no builder output has its text colour replaced', () => {
		expect(hits((l) => /(iconButton|button)\([^)]*\)\s*\.replace\(\s*'text-/.test(l))).toEqual([]);
	});
	it('no colour class follows builder output in a class string', () => {
		const re = new RegExp(
			`(\\{|\\$\\{)(iconButton|button)\\([^)]*\\)\\}[^"\`]*(?<![\\w:-])${COLOUR}(?![\\w-])`
		);
		expect(hits((l) => re.test(l))).toEqual([]);
	});
	it('no field is made invalid by replacing its border', () => {
		expect(hits((l) => /(FIELD|SELECT|TEXTAREA)\.replace\(\s*'border/.test(l))).toEqual([]);
	});
	it('bare text-accent is for icons, rings and fills, not text', () => {
		const bare = /(?<![\w:-])text-accent(?![\w-])/;
		const texty = /text-\[|font-(medium|semibold|bold|extrabold)|underline|<mark/;
		const bad = hits((l) => bare.test(l) && texty.test(l)).filter(
			(h) =>
				!Object.entries(ICON_ONLY).some(([k]) => {
					const [file, sub] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
					return h.startsWith(file + ':') && h.includes(sub);
				})
		);
		expect(bad).toEqual([]);
	});
});
