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
	it('reads the safe area through --safe-*, never env() directly', () => {
		// The Android app sets --safe-* itself; env() there is unreliable (layout.css).
		expect(hits((l) => l.includes('env(safe-area-inset'))).toEqual([]);
	});
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
	it('no .svelte file builds a class with swap()', () => {
		// A component's script runs in no spec, so swap()'s dev guard never sees a
		// token gone from its builder. Variants live in a styles.ts a spec imports.
		const svelte = files.filter(({ f }) => f.endsWith('.svelte'));
		expect(svelte.length).toBeGreaterThan(100);
		const bad = svelte.flatMap(({ f, lines }) =>
			lines.flatMap((l, i) => (/\bswap\(/.test(l) ? [`${f}:${i + 1}: ${l.trim()}`] : []))
		);
		expect(bad).toEqual([]);
	});
	it('every bar pinned to the bottom starts at the pane on the desk', () => {
		// A `fixed inset-x-0` element set to the bottom (a class or a style) would run
		// under the side on the desk: it starts at `--pane-left` (desktop spec, "Pinned
		// bars"), unless it shows on the phone only. Top bars and overlays (`top-0`) aside.
		const bars = files
			.filter(({ f }) => f.endsWith('.svelte'))
			.flatMap(({ f, lines }) => openingTags(lines.join('\n')).map((tag) => ({ f, tag })))
			.filter(({ tag }) => /(?<![\w:-])fixed(?![\w-])/.test(tag))
			.filter(({ tag }) => /(?<![\w:-])inset-x-0(?![\w-])/.test(tag))
			.filter(({ tag }) => /(?<![\w:-])bottom-|style:bottom|bottom:/.test(tag))
			.filter(({ tag }) => !/(?<![\w:-])top-0(?![\w-])/.test(tag));
		// BottomBar, Toast, ReloadBar, VariationBar, BottomNav, SelectionBar, Coverage's bar.
		expect(bars.length).toBeGreaterThanOrEqual(7);
		const bad = bars
			.filter(({ tag }) => !/desk:left-\(--pane-left\)|desk:hidden/.test(tag))
			.map(({ f, tag }) => `${f}: ${tag.slice(0, 120)}`);
		expect(bad).toEqual([]);
	});
});

/** Every opening tag in a component's markup, attributes and `{…}` expressions whole. */
function openingTags(src: string): string[] {
	const out: string[] = [];
	for (let at = src.indexOf('<'); at >= 0; at = src.indexOf('<', at + 1)) {
		if (!/[a-zA-Z]/.test(src[at + 1] ?? '')) continue;
		let depth = 0;
		let quote = '';
		let i = at + 1;
		for (; i < src.length; i++) {
			const c = src[i];
			if (quote) {
				if (c === quote) quote = '';
			} else if (c === '"' || c === "'" || c === '`') quote = c;
			else if (c === '{') depth++;
			else if (c === '}') depth--;
			else if (c === '>' && depth === 0) break;
		}
		out.push(src.slice(at, i + 1));
	}
	return out;
}
