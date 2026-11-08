import { describe, expect, it, vi } from 'vitest';
import { INSTALL_RETRY_MS, installWithRetry, openCopy, type PoolOptions } from './pool';

const busy = () => Object.assign(new Error('busy'), { name: 'NoModificationAllowedError' });

describe('installWithRetry', () => {
	it('tries again after 100, 300 and 1000 ms, never deleting the files, and takes the pool when it comes', async () => {
		const seen: PoolOptions[] = [];
		const slept: number[] = [];
		let fails = 3;
		const pool = await installWithRetry(
			async (opts) => {
				seen.push(opts);
				if (fails-- > 0) throw busy();
				return 'pool';
			},
			'salsa',
			INSTALL_RETRY_MS,
			async (ms) => void slept.push(ms)
		);
		expect(pool).toBe('pool');
		expect(slept).toEqual([100, 300, 1000]);
		expect(seen).toHaveLength(4);
		for (const opts of seen) {
			expect(opts).toEqual({
				name: 'salsa',
				preserveOnInitFailure: true,
				forceReinitIfPreviouslyFailed: true
			});
		}
	});

	it('gives up with the last error after the last wait', async () => {
		const install = vi.fn(async () => {
			throw busy();
		});
		const slept: number[] = [];
		await expect(
			installWithRetry(install, 'salsa', INSTALL_RETRY_MS, async (ms) => void slept.push(ms))
		).rejects.toThrow('busy');
		expect(install).toHaveBeenCalledTimes(4);
		expect(slept).toEqual([100, 300, 1000]);
	});

	it('does not wait when the first try works', async () => {
		const sleep = vi.fn(async () => {});
		expect(await installWithRetry(async () => 1, 'salsa', INSTALL_RETRY_MS, sleep)).toBe(1);
		expect(sleep).not.toHaveBeenCalled();
	});
});

describe('openCopy', () => {
	const steps = () => {
		const order: string[] = [];
		const db = { close: () => void order.push('close') };
		return {
			order,
			db,
			pool: async () => void order.push('pool'),
			open: () => (order.push('db'), db),
			migrate: () => void order.push('migrate'),
			release: () => void order.push('release')
		};
	};

	it('opens the pool, the database, then migrates', async () => {
		const s = steps();
		const db = await openCopy({ pool: s.pool, db: s.open, migrate: s.migrate, release: s.release });
		expect(db).toBe(s.db);
		expect(s.order).toEqual(['pool', 'db', 'migrate']);
	});

	it('closes the database and gives the files back when a migration fails', async () => {
		const s = steps();
		await expect(
			openCopy({
				pool: s.pool,
				db: s.open,
				migrate: () => {
					throw new Error('bad migration');
				},
				release: s.release
			})
		).rejects.toThrow('bad migration');
		expect(s.order).toEqual(['pool', 'db', 'close', 'release']);
	});

	it('gives the files back when the database will not open', async () => {
		const s = steps();
		await expect(
			openCopy({
				pool: s.pool,
				db: () => {
					throw new Error('no db');
				},
				migrate: s.migrate,
				release: s.release
			})
		).rejects.toThrow('no db');
		expect(s.order).toEqual(['pool', 'release']);
	});

	it('releases nothing when the pool itself failed', async () => {
		const s = steps();
		await expect(
			openCopy({
				pool: () => Promise.reject(new Error('busy')),
				db: s.open,
				migrate: s.migrate,
				release: s.release
			})
		).rejects.toThrow('busy');
		expect(s.order).toEqual([]);
	});

	it('still reports the first error when giving back fails', async () => {
		const s = steps();
		await expect(
			openCopy({
				pool: s.pool,
				db: s.open,
				migrate: () => {
					throw new Error('bad migration');
				},
				release: () => {
					throw new Error('open files');
				}
			})
		).rejects.toThrow('bad migration');
	});
});
