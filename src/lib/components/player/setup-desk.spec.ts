import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./Setup.svelte', import.meta.url), 'utf8');

describe('Practice setup on the desktop', () => {
	it('is a 640 page with Play pinned at the same width', () => {
		expect(src).toContain('<Screen width="song"');
		expect(src).toContain('<BottomBar width="song">');
	});
});
