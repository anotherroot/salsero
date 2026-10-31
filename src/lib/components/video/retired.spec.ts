import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

const SRC = join(process.cwd(), 'src');
const files = walk(SRC).filter((f) => /\.(svelte|ts|css)$/.test(f) && !f.endsWith('.spec.ts'));
const player = files.filter(
	(f) => f.includes('/components/video/') || f.endsWith('/ui/VideoPlayer.svelte')
);

describe("the player's own palette and icons are retired", () => {
	it('nothing in src mentions --pl-', () => {
		expect(files.filter((f) => readFileSync(f, 'utf8').includes('--pl-'))).toEqual([]);
	});
	it('the player has no hex colour and no icon set of its own', () => {
		const hex = player.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, 'utf8')));
		// styles.spec.ts asserts on '#' itself; it names no colour.
		expect(hex.filter((f) => !f.endsWith('.spec.ts'))).toEqual([]);
		const own = player.filter((f) =>
			/from '\.\/icons'|video\/Icon\.svelte|video\/icons/.test(readFileSync(f, 'utf8'))
		);
		expect(own).toEqual([]);
	});
});
