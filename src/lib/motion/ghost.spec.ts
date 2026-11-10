import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(f, 'utf8');

describe('toasts, sheets and faces (motion round 1)', () => {
	it('a sheet closed by its owner leaves as a ghost before the dialog closes', () => {
		const sheet = read('src/lib/components/ui/Sheet.svelte');
		const at = sheet.indexOf('if (!open && dialog.open) {');
		expect(at).toBeGreaterThan(-1);
		const block = sheet.slice(at, sheet.indexOf('dialog.close()', at) + 20);
		expect(block.indexOf('sheetLeave(dialog)')).toBeGreaterThan(-1);
		expect(block.indexOf('sheetLeave(dialog)')).toBeLessThan(block.indexOf('dialog.close()'));
	});

	it('a toast rises in', () => {
		expect(read('src/lib/components/ui/Toast.svelte')).toContain('motion-rise');
		expect(read('src/lib/components/video/Toast.svelte')).toContain('motion-rise');
	});

	it('a face pops when tapped', () => {
		expect(read('src/lib/components/exercises/FaceRating.svelte')).toMatch(
			/import \{[^}]*\bplay\b[^}]*\} from '\$lib\/motion\/motion'/
		);
	});

	it('the CSS keyframes only run when motion is welcome', () => {
		const css = read('src/routes/layout.css');
		const welcome = css.indexOf('@media (prefers-reduced-motion: no-preference) {\n\t.motion-rise');
		expect(welcome).toBeGreaterThan(-1);
		expect(css.indexOf('.motion-pop {')).toBeGreaterThan(welcome);
	});

	it('the sheet ghost is still with reduced motion', () => {
		const ghost = read('src/lib/motion/ghost.ts');
		const fn = ghost.slice(ghost.indexOf('export function sheetLeave'));
		expect(fn).toMatch(/reducedMotion\(\)/);
	});
});

describe('review fixes (motion round 1)', () => {
	it('a ghost copy loads no media and joins no radio group', async () => {
		const { scrub } = await import('./ghost');
		type Fake = {
			tagName: string;
			attrs: Map<string, string>;
			kids: Fake[];
			paused?: boolean;
		};
		const el = (tagName: string, attrs: Record<string, string>, kids: Fake[] = []): Fake => ({
			tagName,
			attrs: new Map(Object.entries(attrs)),
			kids
		});
		const api = (f: Fake): Element =>
			({
				tagName: f.tagName,
				removeAttribute: (n: string) => f.attrs.delete(n),
				getAttributeNames: () => [...f.attrs.keys()],
				querySelectorAll: () => {
					const all: Element[] = [];
					const walk = (x: Fake) => x.kids.forEach((k) => (all.push(api(k)), walk(k)));
					walk(f);
					return all;
				}
			}) as unknown as Element;
		const video = el('VIDEO', { src: '/v/1', autoplay: '', class: 'x' }, [
			el('SOURCE', { src: '/v/1.mp4' })
		]);
		const radio = el('INPUT', { type: 'radio', name: 'rhythm', id: 'r1', 'data-focus': 'f' });
		const root = el('LI', { 'data-flip': '3' }, [video, radio]);
		scrub(api(root));
		expect([...root.attrs.keys()]).toEqual([]);
		expect([...video.attrs.keys()]).toEqual(['class']);
		expect([...video.kids[0].attrs.keys()]).toEqual([]);
		expect([...radio.attrs.keys()]).toEqual(['type']);
	});

	it('the call does not rise over an open layer on the phone', () => {
		const running = read('src/lib/components/player/Running.svelte');
		const pre = running.slice(
			running.indexOf('!callMoves(calls, now)'),
			running.indexOf('return;', running.indexOf('!callMoves(calls, now)'))
		);
		expect(pre).toContain('(layer !== null && !desk.current)');
	});

	it('the bar card announces only the words it holds now', () => {
		const bar = read('src/lib/components/today/TodayBar.svelte');
		expect(bar).toContain('<span class="sr-only">{hero.title}');
		expect(bar.match(/\{#key view\.(title|meta)\}<span\n\t*aria-hidden="true"/g)?.length).toBe(2);
	});
});
