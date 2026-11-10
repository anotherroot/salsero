import { describe, expect, it } from 'vitest';
import { SITE_BUILT_AT, SITE_VERSION } from './build-info';

describe('build info', () => {
	it('carries the commit count and the build time', () => {
		expect(Number.isInteger(SITE_VERSION) && SITE_VERSION > 1000).toBe(true);
		expect(SITE_BUILT_AT).toBeGreaterThan(Date.UTC(2026, 0, 1));
	});
});
