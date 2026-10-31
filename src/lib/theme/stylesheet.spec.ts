import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DANCE_SLUGS } from '$lib/dances/dances';
import { BAND_TRACK, MEDIA, SCRIM, THEMES, TOKEN_NAMES } from './tokens';

const css = readFileSync('src/routes/layout.css', 'utf8').toLowerCase();
const block = (sel: RegExp) => css.match(sel)?.[1] ?? '';

/** The `--color-*` pairs of the first block opened by `selector` (blocks here do not nest). */
function colours(selector: string): Record<string, string> {
	const at = css.indexOf(selector.toLowerCase());
	if (at < 0) throw new Error(`no block ${selector}`);
	const body = css.slice(at + selector.length, css.indexOf('}', at));
	const out: Record<string, string> = {};
	for (const m of body.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
	return out;
}

const SALSA_LIGHT = colours('@theme {');
const BACHATA_LIGHT = colours("\n\t[data-dance='bachata'] {");
const SALSA_DARK = colours("\n\t\t:root:not([data-theme='light']) {");
const BACHATA_DARK = colours("\n\t\t:root:not([data-theme='light']) [data-dance='bachata'] {");

/** Each theme as the cascade resolves it: later blocks override earlier ones. */
const RESOLVED = {
	salsa: {
		light: SALSA_LIGHT,
		dark: { ...SALSA_LIGHT, ...SALSA_DARK }
	},
	bachata: {
		light: { ...SALSA_LIGHT, ...BACHATA_LIGHT },
		dark: { ...SALSA_LIGHT, ...SALSA_DARK, ...BACHATA_LIGHT, ...BACHATA_DARK }
	}
};

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const path = join(dir, f);
		if (statSync(path).isDirectory()) return sources(path);
		return /\.(svelte|ts)$/.test(f) ? [path] : [];
	});
}

describe('layout.css', () => {
	it('resolves to exactly the tokens of every theme, block by block', () => {
		for (const d of DANCE_SLUGS)
			for (const s of ['light', 'dark'] as const) {
				const got = Object.fromEntries(TOKEN_NAMES.map((n) => [n, RESOLVED[d][s][n]]));
				const want = Object.fromEntries(TOKEN_NAMES.map((n) => [n, THEMES[d][s][n].toLowerCase()]));
				expect(got, `${d} ${s}`).toEqual(want);
			}
	});
	it('names every token', () => {
		for (const n of TOKEN_NAMES) expect(css, n).toContain(`--color-${n}:`);
	});
	it('defines none of the old names', () => {
		for (const old of ['plane', 'line', 'rule', 'done-bg', 'accent-ink', 'overdue'])
			expect(css, old).not.toContain(`--color-${old}:`);
		const OLD =
			/(?<![\w-])(bg|text|border|divide|ring|outline|fill|stroke|from|via|to|decoration|caret|placeholder|shadow)-(plane|line|rule|done-bg|accent-ink|overdue)(?![\w-])/;
		const VAR = /var\(--color-(plane|line|rule|done-bg|accent-ink|overdue)\)/;
		const hits: string[] = [];
		for (const file of sources('src'))
			readFileSync(file, 'utf8')
				.split('\n')
				.forEach((line, i) => {
					if (OLD.test(line) || VAR.test(line)) hits.push(`${file}:${i + 1}`);
				});
		expect(hits).toEqual([]);
	});
	it('has the scrim and the band track, equal to their constants', () => {
		expect(SALSA_LIGHT.scrim).toBe(SCRIM.toLowerCase());
		expect(SALSA_LIGHT['band-track']).toBe(BAND_TRACK.toLowerCase());
		const backdrop = css.match(/\ndialog::backdrop\s*\{\s*background:\s*([^;]+);/)?.[1];
		expect(backdrop).toBe(SCRIM.toLowerCase());
	});
	it('leaves no hard-coded scrim or band track outside the player’s own alphas', () => {
		const hits: string[] = [];
		for (const file of [...sources('src/lib/components'), ...sources('src/routes')]) {
			if (file.includes('components/video/') || file.endsWith('ui/VideoPlayer.svelte')) continue;
			if (file.endsWith('.spec.ts')) continue;
			readFileSync(file, 'utf8')
				.split('\n')
				.forEach((line, i) => {
					if (/0 0 0 \/ 0\.45|bg-black\/45|bg-black\/15/.test(line)) hits.push(`${file}:${i + 1}`);
				});
		}
		expect(hits).toEqual([]);
	});
	it('scopes the media palette for the player’s layers', () => {
		const salsa = block(/\n\s*\.theme-media\s*\{([^}]*)\}/);
		for (const n of TOKEN_NAMES)
			expect(salsa, n).toContain(`--color-${n}: ${MEDIA.salsa[n].toLowerCase()};`);
		const bachata = block(/\[data-dance='bachata'\]\s+\.theme-media\s*\{([^}]*)\}/);
		for (const n of [
			'band',
			'accent',
			'accent-text',
			'accent-soft',
			'on-accent',
			'status'
		] as const)
			expect(bachata, n).toContain(`--color-${n}: ${MEDIA.bachata[n].toLowerCase()};`);
	});
});
