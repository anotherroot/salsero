import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import PaneLandmarks from './fixtures/PaneLandmarks.svelte';

/*
 * The pane's Back gate and the page's landmarks (desktop plan 3, Task 5).
 *
 * Landmarks: a list and its item are rendered on the server (`svelte/server`) and
 * the markup read as each width shows it: an element whose classes hide it at that
 * width is out of the tree (`hidden` on the phone; `desk:hidden`, or `hidden`
 * without a `desk:` display, on the desktop). `display: contents` keeps its role,
 * so a box that is `contents` still counts. CSS itself is the screenshot rig's.
 */
vi.mock('$app/state', () => ({
	page: {
		data: {},
		params: { dance: 'salsa' },
		route: { id: '/[dance]/(moves)/figures/[id]' },
		url: new URL('http://localhost/salsa/figures/1')
	}
}));

interface Node {
	tag: string;
	attrs: string;
	children: Node[];
	text: string;
	parent: Node | null;
}

const VOID = new Set([
	'area',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'wbr'
]);

/** A small HTML tree: enough for the server's own well-formed markup. */
function parse(html: string): Node {
	const root: Node = { tag: '#root', attrs: '', children: [], text: '', parent: null };
	let at = root;
	let last = 0;
	const tags = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
	for (const m of html.matchAll(tags)) {
		at.text += html.slice(last, m.index);
		last = m.index + m[0].length;
		if (!m[2]) continue;
		const tag = m[2].toLowerCase();
		if (m[1]) {
			let n: Node | null = at;
			while (n && n.tag !== tag) n = n.parent;
			if (n?.parent) at = n.parent;
			continue;
		}
		const node: Node = { tag, attrs: m[3], children: [], text: '', parent: at };
		at.children.push(node);
		if (!VOID.has(tag) && !m[3].trim().endsWith('/')) at = node;
	}
	return root;
}

const classes = (n: Node) => (/\bclass="([^"]*)"/.exec(n.attrs)?.[1] ?? '').split(/\s+/);
type Width = 'phone' | 'desk';
function shown(n: Node, width: Width): boolean {
	if (/aria-hidden="true"/.test(n.attrs)) return false;
	const c = classes(n);
	if (width === 'phone') return !c.includes('hidden');
	if (c.includes('desk:hidden')) return false;
	return !c.includes('hidden') || c.some((x) => /^desk:(flex|block|grid|contents|inline)/.test(x));
}
/** The elements this width shows, in document order. */
function visible(root: Node, width: Width): Node[] {
	const out: Node[] = [];
	const walk = (n: Node) => {
		for (const c of n.children)
			if (shown(c, width)) {
				out.push(c);
				walk(c);
			}
	};
	walk(root);
	return out;
}
const textOf = (n: Node): string => n.text + n.children.map(textOf).join('');
const within = (n: Node, tags: string[]) => {
	for (let p = n.parent; p; p = p.parent) if (tags.includes(p.tag)) return true;
	return false;
};

function landmarks(isList: boolean, width: Width) {
	const { body } = render(PaneLandmarks, { props: { isList } });
	const els = visible(parse(body), width);
	return {
		main: els.filter((n) => n.tag === 'main').map((n) => textOf(n)),
		banner: els
			.filter(
				(n) => n.tag === 'header' && !within(n, ['main', 'section', 'article', 'aside', 'nav'])
			)
			.map((n) => textOf(n)),
		h1: els.filter((n) => n.tag === 'h1').map((n) => textOf(n).trim()),
		text: els.map((n) => n.text).join(' ')
	};
}

describe('landmarks of a list and its item', () => {
	for (const width of ['phone', 'desk'] as const) {
		it(`list route, ${width}: one main, one banner, the tab's name the h1`, () => {
			const l = landmarks(true, width);
			expect(l.main).toHaveLength(1);
			expect(l.banner).toHaveLength(1);
			expect(l.h1).toEqual(['Moves']);
		});

		it(`item route, ${width}: the item's header the banner, its sheet the main, its name the h1`, () => {
			const l = landmarks(false, width);
			expect(l.banner).toHaveLength(1);
			expect(l.banner[0]).toContain('Enchufla · Doble');
			expect(l.main).toHaveLength(1);
			expect(l.main[0]).toContain('Its facts');
			expect(l.main[0]).not.toContain('Enchufla · Doble');
			expect(l.h1).toEqual(['Enchufla · Doble']);
		});
	}

	it('the list beside an open item: its band row on the desk only, never a landmark', () => {
		expect(landmarks(false, 'desk').text).toContain('Moves');
		expect(landmarks(false, 'phone').text).not.toContain('Moves');
	});

	it('the pane’s `below` row: on the desk, never on the phone', () => {
		expect(landmarks(false, 'desk').banner[0]).toContain('Below the title');
		expect(landmarks(false, 'phone').text).not.toContain('Below the title');
	});

	it('a Stop editing × in `left` shows in the pane at both widths', () => {
		for (const width of ['phone', 'desk'] as const)
			expect(landmarks(false, width).banner[0]).toContain('×');
	});
});

/*
 * The Back gate reads the trail in the browser, so its source is what a spec can
 * hold: the rule and that it is CSS, not "renders nothing".
 */
const read = (f: string) => readFileSync(f, 'utf8');
const code = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the pane’s Back gate', () => {
	const back = code(read('src/lib/components/shell/BackButton.svelte'));

	it('is BackButton’s: paneBack by the list opener, hidden on the desk only', () => {
		expect(back).toMatch(/paneBack\(\s*opener/);
		expect(back).toMatch(/listOpener\(page\.url\.pathname\)/);
		expect(back).toMatch(/listOf\(page\.route\.id\)/);
		// CSS only: inPane() is true at every width, so the phone keeps its ‹.
		expect(back).toMatch(/'contents desk:hidden'/);
		expect(back).not.toMatch(/\{#if\s+!?hidden\}/);
	});

	it('is no longer Screen’s or BandHeader’s', () => {
		for (const f of [
			'src/lib/components/ui/Screen.svelte',
			'src/lib/components/shell/BandHeader.svelte'
		]) {
			const s = code(read(f));
			expect(s).not.toContain('paneBack');
			expect(s).not.toMatch(/\{back\}|\bback\s*[?]?:|\bback\s*=|\$\{back/);
		}
	});
});
