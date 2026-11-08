import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'src/lib/components';

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? svelteFiles(p) : p.endsWith('.svelte') ? [p] : [];
	});
}

describe('inline videos on desktop', () => {
	it('every aspect-video box is capped at 70 % of the window height', () => {
		const bad: string[] = [];
		let seen = 0;
		for (const f of svelteFiles(ROOT)) {
			if (f.endsWith('shell/PageSkeleton.svelte')) continue;
			for (const m of readFileSync(f, 'utf8').matchAll(/class="([^"]*aspect-video[^"]*)"/g)) {
				seen++;
				if (!m[1].includes('desk:max-h-[70dvh]')) bad.push(`${f}: ${m[1]}`);
			}
		}
		expect(seen).toBeGreaterThanOrEqual(3);
		expect(bad).toEqual([]);
	});

	it('the YouTube thumbnail letterboxes on desktop', () => {
		const s = readFileSync(`${ROOT}/links/YouTubeCard.svelte`, 'utf8');
		expect(s).toContain('object-cover desk:object-contain');
	});
});

describe('the player layer as a dialog', () => {
	const layer = readFileSync(`${ROOT}/ui/PlayerLayer.svelte`, 'utf8');
	it('has no grabber on desk', () => {
		expect(layer).toMatch(/h-\[5px\][^"]*desk:hidden/);
	});
	it("takes size='small': 480 in place of 560, never both", () => {
		expect(layer).toContain("size?: 'small'");
		expect(layer).toMatch(/size\s*===\s*'small'/);
		expect(layer).toContain("'desk:w-[480px]'");
		expect(layer).toContain("'desk:w-[560px]'");
		expect(layer).toContain('overflow-clip');
	});
	it('a level is drawn 480 tall in both the layer and the sheet', () => {
		expect(layer).toContain('desk:h-[480px]');
		const sheet = readFileSync(`${ROOT}/ui/Sheet.svelte`, 'utf8');
		expect(sheet).toContain('dialog.level {\n\t\t\theight: 480px;');
		const lvl = readFileSync(`${ROOT}/links/LinkLevel.svelte`, 'utf8');
		expect(lvl).toContain('<PlayerLayer level');
		expect(lvl).toContain('<Sheet open level');
	});
	it('Rename is small', () => {
		const s = readFileSync(`${ROOT}/video/PlayerSheet.svelte`, 'utf8');
		expect(s).toMatch(/size="small"\s+title=\{w\.editor\.rename\}/);
	});
});

describe('the Link popup picker is a level', () => {
	it('LinkPopup opens its Picker as a level and Picker forwards it to both branches', () => {
		expect(readFileSync(`${ROOT}/links/LinkPopup.svelte`, 'utf8')).toMatch(/<Picker\s+level\s/);
		const p = readFileSync(`${ROOT}/picker/Picker.svelte`, 'utf8');
		expect(p).toContain('level?: boolean');
		expect(p.match(/^\s*\{level\}$/gm)?.length).toBe(2);
	});
	it('a level wins over tall on desk, in the layer and in the sheet', () => {
		const layer = readFileSync(`${ROOT}/ui/PlayerLayer.svelte`, 'utf8');
		expect(layer).toContain("'h-[88%] desk:h-[480px]'");
		const sheet = readFileSync(`${ROOT}/ui/Sheet.svelte`, 'utf8');
		expect(sheet.indexOf('dialog.level {')).toBeGreaterThan(
			sheet.indexOf('dialog.tall {\n\t\t\theight: min')
		);
	});
});
