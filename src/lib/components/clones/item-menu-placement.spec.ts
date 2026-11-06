import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `Screen` draws a page's band twice (the big header and the slim band), so a
 * sheet inside the band would exist twice and open twice. Each family page
 * mounts its ⋯ menu once, after every snippet, and keeps only the button in
 * the band (spec 2026-11-06).
 */
const PAGES = [
	'src/routes/[dance]/(moves)/figures/[id]/+page.svelte',
	'src/routes/[dance]/(moves)/positions/[id]/+page.svelte',
	'src/routes/[dance]/(moves)/routines/[id]/+page.svelte',
	'src/routes/[dance]/(today)/exercises/[id]/+page.svelte',
	'src/routes/[dance]/songs/[id]/+page.svelte',
	'src/routes/[dance]/lessons/[id]/+page.svelte'
];

describe('the ⋯ menu on a family page', () => {
	it.each(PAGES)('%s mounts it once, outside the band', (path) => {
		const page = readFileSync(path, 'utf8');
		expect(page.match(/<ItemMenu\b/g)).toHaveLength(1);
		expect(page.indexOf('<ItemMenu')).toBeGreaterThan(page.lastIndexOf('{/snippet}'));
		expect(page).toContain('icon="more"');
	});
});
