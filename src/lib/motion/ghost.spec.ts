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
