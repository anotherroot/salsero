import { describe, expect, it } from 'vitest';
import { deviceMigrations } from './migrations';
import { repoMigrations } from './test-migrations';

describe('deviceMigrations', () => {
	it('bundles every migration, in journal order, with its text', () => {
		const bundled = deviceMigrations();
		expect(bundled.length).toBeGreaterThan(30);
		expect(bundled).toEqual(repoMigrations());
	});
});
