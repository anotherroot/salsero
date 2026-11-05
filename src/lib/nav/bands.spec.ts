import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { frameOf } from './frame';

// Pages that draw no band of their own, each with its reason.
const NO_BAND: Record<string, string> = {
	'src/routes/dev/kit/+page.svelte': 'dev gallery',
	'src/routes/[dance]/(moves)/figures/+page.svelte': 'MovesScreen draws the band',
	'src/routes/[dance]/(moves)/routines/+page.svelte': 'MovesScreen draws the band',
	'src/routes/[dance]/(moves)/positions/+page.svelte': 'MovesScreen draws the band',
	'src/routes/[dance]/player/+page.svelte': 'Setup draws the band, Running draws the stage',
	'src/routes/[dance]/songs/+page.svelte':
		'the songs layout draws the band (ListPane); this is the empty pane'
};

describe('bands', () => {
	it('gives every page a band', () => {
		for (const file of globSync('src/routes/**/+page.svelte')) {
			if (file in NO_BAND) continue;
			expect(readFileSync(file, 'utf8'), file).toMatch(/<(Screen|ErrorScreen|CardFrame)\b/);
		}
	});

	// Desktop spec, "Pages without the side": no frame, the title on the band, the form in a card.
	it('draws every card page through CardFrame, and nothing else', () => {
		const card: string[] = [];
		for (const file of globSync('src/routes/**/+page.svelte')) {
			const id = '/' + file.replace(/^src\/routes\//, '').replace(/\/?\+page\.svelte$/, '');
			const src = readFileSync(file, 'utf8');
			if (frameOf(id, true) === 'card') {
				card.push(id);
				expect(src, file).toMatch(/<CardFrame\b/);
				expect(src, file).not.toMatch(/<Screen\b/);
			} else expect(src, file).not.toMatch(/<CardFrame\b/);
		}
		expect(card).toHaveLength(6);
	});
});
