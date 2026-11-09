import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { SLOT_SIZE } from './db/ids';
import { createCustomExercise, logSet } from './exercises';
import { U1_SALSA } from './test-walls';
import { serverNow } from './server-clock';
import { replayName, runReplaying, type ReplayContext } from './replay-context';

const ctx = (over: Partial<ReplayContext> = {}): ReplayContext => ({
	entryId: 'e1',
	madeAt: 1000,
	minted: new Map(),
	flows: [],
	deferFlows: true,
	...over
});
const set = (exerciseId: number) => ({
	exerciseId,
	doneAt: 1000,
	durationS: null,
	reps: null,
	rating: 3,
	note: null,
	playerJson: null
});

describe('the replay context', () => {
	it('reads the made-at inside a replay and the clock outside', () => {
		expect(runReplaying(ctx({ madeAt: 1000 }), () => serverNow())).toBe(1000);
		const now = serverNow();
		expect(Math.abs(now - Date.now())).toBeLessThan(1000);
	});

	it("mints the entry's ids in order, then the server's slot", () => {
		const db = openDb(':memory:');
		const ex = createCustomExercise(db, U1_SALSA, { name: 'x', everyDays: 1, notes: null });
		const a = 3 * SLOT_SIZE + 5;
		const b = 3 * SLOT_SIZE + 9;
		const ids = runReplaying(ctx({ minted: new Map([['sets', [a, b]]]) }), () => [
			logSet(db, set(ex.id)).id,
			logSet(db, set(ex.id)).id,
			logSet(db, set(ex.id)).id
		]);
		expect(ids).toEqual([a, b, 1]);
	});

	it('keeps two replays apart across awaits', async () => {
		const tick = () => new Promise((r) => setTimeout(r, 5));
		const read = (madeAt: number) =>
			runReplaying(ctx({ madeAt }), async () => {
				await tick();
				const first = serverNow();
				await tick();
				return [first, serverNow()];
			});
		const [one, two] = await Promise.all([read(1000), read(2000)]);
		expect(one).toEqual([1000, 1000]);
		expect(two).toEqual([2000, 2000]);
	});

	it('suffixes a taken name only on replay', () => {
		const taken = (n: string) => n === 'Basic';
		expect(replayName('Basic', taken)).toBe('Basic');
		expect(runReplaying(ctx(), () => replayName('Basic', taken))).toBe('Basic (2)');
		expect(runReplaying(ctx(), () => replayName('Free', taken))).toBe('Free');
	});
});
