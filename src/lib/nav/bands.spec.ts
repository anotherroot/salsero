import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pages that draw no band of their own, each with its reason.
const NO_BAND: Record<string, string> = {
	'src/routes/dev/kit/+page.svelte': 'dev gallery',
	'src/routes/[dance]/figures/+page.svelte': 'MovesScreen draws the band',
	'src/routes/[dance]/routines/+page.svelte': 'MovesScreen draws the band',
	'src/routes/[dance]/player/+page.svelte': 'Setup draws the band, Running draws the stage'
};

describe('bands', () => {
	it('gives every page a band', () => {
		for (const file of globSync('src/routes/**/+page.svelte')) {
			if (file in NO_BAND) continue;
			expect(readFileSync(file, 'utf8'), file).toMatch(/<(Screen|ErrorScreen)\b/);
		}
	});
});
