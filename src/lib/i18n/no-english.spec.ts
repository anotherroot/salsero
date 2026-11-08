import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { englishIn } from './no-english';

// Every component draws its words from the catalog: a bare English string in
// one is a word left untranslated. Every .svelte under src/lib/components and
// src/routes is checked, a new one included, except the dev pages and EXEMPT.

/** Components the guard does not read, each with its reason. */
const EXEMPT: ReadonlyMap<string, string> = new Map([
	[
		'src/lib/components/shell/fixtures/PaneLandmarks.svelte',
		'a spec fixture, never drawn in the app: its sample names stand for content'
	]
]);

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

/** Every component checked: all of them but the dev gallery's and EXEMPT. */
const TRANSLATED: string[] = [...walk('src/lib/components'), ...walk('src/routes')].filter(
	(path) => path.endsWith('.svelte') && !path.startsWith('src/routes/dev/') && !EXEMPT.has(path)
);

describe('englishIn', () => {
	it("finds an attribute's English, not an expression's", () => {
		expect(englishIn('<button aria-label="Close">{t().common.close}</button>')).toEqual(['Close']);
	});

	it('passes expressions and symbols', () => {
		expect(englishIn('<p>{x}</p><span>·</span>')).toEqual([]);
	});

	it('skips scripts, and text without a word', () => {
		expect(englishIn('<script>const a = "Hi there"</script><b>3 × 2</b>')).toEqual([]);
	});

	it("finds a component's static props", () => {
		expect(englishIn('<Sheet title="Invite someone">')).toEqual(['Invite someone']);
	});

	it('finds text nodes and skips styles, comments and nested braces', () => {
		expect(
			englishIn(
				'<style>.a { color: red }</style><!-- a note --><p>{f({ a: "No way" })} Save it</p>'
			)
		).toEqual(['Save it']);
	});

	it('skips a comment inside an expression, an apostrophe in it included', () => {
		expect(
			englishIn(
				"<form use:guarded={{\n\t// the layout's list stays\n\tlabel: t().a /* it's */\n}}>Save it</form>"
			)
		).toEqual(['Save it']);
	});

	it('passes an attribute that is an expression, and one it does not read', () => {
		expect(englishIn('<input placeholder={t().common.search} class="w-full px-2" />')).toEqual([]);
	});
});

describe('components', () => {
	it('are all read, the exempt ones still there', () => {
		expect(TRANSLATED.length).toBeGreaterThan(200);
		expect([...EXEMPT.keys()].filter((path) => !statSync(path, { throwIfNoEntry: false }))).toEqual(
			[]
		);
	});

	it('have no bare English', () => {
		const found = Object.fromEntries(
			TRANSLATED.map((path) => [path, englishIn(readFileSync(path, 'utf8'))] as const).filter(
				([, words]) => words.length > 0
			)
		);
		expect(found).toEqual({});
	});
});
