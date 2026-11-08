// The player logs nothing (one-player design, 2026-11-08): Done on the
// exercise page is the only way a practice becomes a set.
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ getDb: () => null }));

describe('the player route', () => {
	it('has no action that saves a run', async () => {
		const route: Record<string, unknown> = await import('./+page.server');
		expect(Object.keys((route.actions as object | undefined) ?? {})).toEqual([]);
	});
});
