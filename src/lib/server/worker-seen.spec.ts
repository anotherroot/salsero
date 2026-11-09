import { beforeEach, describe, expect, it } from 'vitest';
import { noteWorkerSeen, resetWorkerSeen, workerStatus } from './worker-seen';

const T = 1_800_000_000_000;
const MIN = 60_000;

describe('workerStatus', () => {
	beforeEach(resetWorkerSeen);

	it('is unknown until the worker is seen, then online for 15 minutes', () => {
		expect(workerStatus(T)).toBe('unknown');
		noteWorkerSeen(T);
		expect(workerStatus(T + 14 * MIN)).toBe('online');
		expect(workerStatus(T + 16 * MIN)).toBe('offline');
	});
});
