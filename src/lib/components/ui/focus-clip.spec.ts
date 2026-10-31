import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A clipping element cuts off the outside focus ring of the controls in it, so
 * every `overflow-hidden` is a `CLIP` card (`focus-inset`) unless nothing
 * focusable sits against its edge. The list below says why, line by line.
 */
const ALLOWED: [file: string, line: string, why: string][] = [
	['src/lib/components/shell/NavProgress.svelte', 'overflow-hidden', 'a bar, nothing inside'],
	['src/lib/components/ui/UploadCard.svelte', 'h-1.5 overflow-hidden', 'progress track'],
	['src/lib/components/songs/UploadRow.svelte', 'h-1.5 overflow-hidden', 'progress track'],
	['src/routes/voice/+page.svelte', 'h-1.5 flex-1 overflow-hidden', 'progress track'],
	['src/lib/components/exercises/LogShell.svelte', 'aria-hidden', 'skeleton'],
	['src/lib/components/shell/PageSkeleton.svelte', 'overflow-hidden', 'skeleton, aria-hidden'],
	[
		'src/lib/components/links/YouTubeCard.svelte',
		'h-16 w-28',
		'the link itself; its own outline is not clipped'
	],
	[
		'src/lib/components/ui/VideoPlayer.svelte',
		'stage relative',
		'the full-screen stage: its controls sit inside the screen, not against its edge'
	],
	[
		'src/lib/components/ui/VideoPlayer.svelte',
		'area-video',
		'the video element area; the controls over it sit inset'
	],
	[
		'src/lib/components/video/TrimStrip.svelte',
		'h-16 shrink-0',
		'the strip clips its handles; they are not tab stops (buttons and I / O move them)'
	],
	[
		'src/lib/components/ui/PlayerLayer.svelte',
		'sheet-panel',
		'the sheet panel: its header controls sit at least 8 px in; its rows are in their own CLIP cards'
	]
];

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		if (e.isDirectory()) return svelteFiles(p);
		return e.name.endsWith('.svelte') ? [p] : [];
	});
}

describe('clipping cards', () => {
	it('every overflow-hidden is a focus-inset card or allowed with a reason', () => {
		const bad: string[] = [];
		const all = svelteFiles('src');
		expect(all.length).toBeGreaterThan(100);
		for (const file of all) {
			readFileSync(file, 'utf8')
				.split('\n')
				.forEach((text, i) => {
					if (!text.includes('overflow-hidden') || text.includes('focus-inset')) return;
					const ok = ALLOWED.some(([f, sub]) => file === f && text.includes(sub));
					if (!ok) bad.push(`${file}:${i + 1}: ${text.trim()}`);
				});
		}
		expect(bad).toEqual([]);
	});

	it('every allowlist entry still matches a line', () => {
		for (const [file, sub] of ALLOWED) {
			const lines = readFileSync(file, 'utf8').split('\n');
			expect(
				lines.some((l) => l.includes('overflow-hidden') && l.includes(sub)),
				`${file} ${sub}`
			).toBe(true);
		}
	});
});
