import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('the admin page on the desktop', () => {
	it('is the two-column width', () => {
		expect(page).toContain('<Screen title="Admin" width="two">');
	});
	it('holds two columns that vanish on the phone (display: contents)', () => {
		expect(page).toContain('contents desk:grid desk:grid-cols-2 desk:items-start desk:gap-8');
		expect(page.match(/contents desk:flex desk:flex-col desk:gap-2/g)).toHaveLength(2);
	});
});
