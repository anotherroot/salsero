// A guard against new English in a translated component (no-english.spec.ts). PURE.
//
// It reads a .svelte file's markup, not its script: the static text nodes and
// the static values of the attributes that are words. Expressions (`{…}`,
// nested braces and strings in them included) are the catalog's, so they are
// removed first. A string counts when it has a run of two or more Latin
// letters; symbols, digits and "·" alone do not.

const WORD_ATTRIBUTES = new Set([
	'aria-label',
	'title',
	'placeholder',
	'alt',
	'label',
	'heading',
	'subtitle',
	'message',
	'confirm',
	'hint'
]);

/** What an expression is replaced with: no letters, and not a quote, brace or tag. */
const HOLE = '\u0000';

const WORD = /\p{Script=Latin}{2,}/u;

/** Removes every `{…}` at the top level, skipping strings inside it so a quoted brace does not count. */
function withoutExpressions(src: string): string {
	let out = '';
	let i = 0;
	while (i < src.length) {
		if (src[i] !== '{') {
			out += src[i++];
			continue;
		}
		let depth = 0;
		while (i < src.length) {
			const c = src[i];
			if (c === '"' || c === "'" || c === '`') {
				i = skipString(src, i);
				continue;
			}
			// A comment in an expression (a `use:` callback's): its apostrophes are not quotes.
			if (c === '/' && src[i + 1] === '/') {
				const end = src.indexOf('\n', i);
				i = end < 0 ? src.length : end;
				continue;
			}
			if (c === '/' && src[i + 1] === '*') {
				const end = src.indexOf('*/', i + 2);
				i = end < 0 ? src.length : end + 2;
				continue;
			}
			if (c === '{') depth++;
			else if (c === '}') {
				depth--;
				if (depth === 0) {
					i++;
					break;
				}
			}
			i++;
		}
		out += HOLE;
	}
	return out;
}

/** The index after the string that starts at `start`. A template's `${…}` is skipped by brace depth. */
function skipString(src: string, start: number): number {
	const quote = src[start];
	let i = start + 1;
	while (i < src.length) {
		const c = src[i];
		if (c === '\\') {
			i += 2;
			continue;
		}
		if (c === quote) return i + 1;
		if (quote === '`' && c === '$' && src[i + 1] === '{') {
			let depth = 0;
			while (i < src.length) {
				if (src[i] === '{') depth++;
				else if (src[i] === '}' && --depth === 0) break;
				else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
					i = skipString(src, i);
					continue;
				}
				i++;
			}
		}
		i++;
	}
	return i;
}

function clean(s: string): string {
	return s
		.replaceAll(HOLE, ' ')
		.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const TAG =
	/<\/?[A-Za-z][\w:.-]*((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s=>/"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function englishIn(svelteSource: string): string[] {
	const markup = withoutExpressions(
		svelteSource
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
	);

	const found: string[] = [];
	const keep = (raw: string) => {
		const s = clean(raw);
		if (WORD.test(s)) found.push(s);
	};

	let last = 0;
	for (const tag of markup.matchAll(TAG)) {
		keep(markup.slice(last, tag.index));
		last = tag.index + tag[0].length;
		for (const a of (tag[1] ?? '').matchAll(ATTRIBUTE)) {
			if (WORD_ATTRIBUTES.has(a[1])) keep(a[2] ?? a[3] ?? '');
		}
	}
	keep(markup.slice(last));
	return found;
}
