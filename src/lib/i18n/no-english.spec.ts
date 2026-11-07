import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { englishIn } from './no-english';

// Components whose words all come from the catalog: a bare English string in
// one of them is a word left untranslated. Every task that translates a
// component adds it here.
const TRANSLATED: string[] = [];

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

	it('passes an attribute that is an expression, and one it does not read', () => {
		expect(englishIn('<input placeholder={t().common.search} class="w-full px-2" />')).toEqual([]);
	});
});

describe('translated components', () => {
	it('have no bare English', () => {
		// One test, not it.each: an empty list is an empty suite, which vitest refuses.
		const found = Object.fromEntries(
			TRANSLATED.map((path) => [path, englishIn(readFileSync(path, 'utf8'))] as const).filter(
				([, words]) => words.length > 0
			)
		);
		expect(found).toEqual({});
	});
});
