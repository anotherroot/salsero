import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Offline phase 5 (the user's pick, 2026-11-10): with no signal and no device to
// answer, a link no longer opens the old full-screen Offline layer; the page stays
// and the toast says the page needs a connection.
describe('a page that cannot load offline', () => {
	it('stays, and the toast says so: no Offline layer', () => {
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(layout).toContain('t().shell.offline.pageNeedsConnection');
		expect(layout).not.toContain('errorView(0, undefined, true)');
		expect(layout).not.toContain('retryOffline');
	});
});
