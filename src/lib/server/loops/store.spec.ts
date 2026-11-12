import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { recordings, videoLoops } from '../db/schema';
import { makeWorld, type World } from '../sync/test-world';
import { CLASS_ED } from '../test-class';
import { linkInSpace, unlinkSpot } from '../spot-links';
import { updateSpot, deleteSpot } from '../spots';
import { LEASE_MS, MAX_ATTEMPTS } from '../songs';
import { claimLoop, failLoop, finishLoop, loopSource, queueLoops } from './store';

const T = 1_800_000_000_000;

/** The world, with only u1's recording section linked to a figure (u4's twin of it unlinked). */
function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	const w = makeWorld(db);
	unlinkSpot(db, w.own.u4.spotLink, { figureId: w.own.u4.figure }, T);
	return { db, w };
}
const rows = (db: Db) => db.select().from(videoLoops).all();
const wall = { userId: 'u1', dance: 'salsa' } as const;

describe('queueLoops', () => {
	it('queues a figure-linked section once', () => {
		const { db, w } = setup();
		expect(queueLoops(db, T).queued).toBe(1);
		expect(queueLoops(db, T + 1).queued).toBe(0);
		expect(rows(db)).toMatchObject([
			{ spotId: w.own.u1.spot, startMs: 0, endMs: 1000, status: 'queued' }
		]);
	});

	it('queues a section once it is linked to a figure', () => {
		const { db, w } = setup();
		queueLoops(db, T);
		linkInSpace(db, wall, w.own.u1.videoSpot, { figureId: w.own.u1.figure });
		expect(queueLoops(db, T + 1).queued).toBe(1);
		expect(rows(db).map((r) => r.spotId)).toContain(w.own.u1.videoSpot);
	});

	it('skips a drill link', () => {
		const { db, w } = setup();
		linkInSpace(db, CLASS_ED, w.group.spot, { exerciseId: w.group.drill });
		queueLoops(db, T);
		expect(rows(db).map((r) => r.spotId)).not.toContain(w.group.spot);
	});

	it('skips a phone-only video until the server has it', () => {
		const { db, w } = setup();
		db.update(recordings)
			.set({ serverCopy: false })
			.where(eq(recordings.id, w.own.u1.recording))
			.run();
		expect(queueLoops(db, T).queued).toBe(0);
		db.update(recordings)
			.set({ serverCopy: true })
			.where(eq(recordings.id, w.own.u1.recording))
			.run();
		expect(queueLoops(db, T + 1).queued).toBe(1);
	});

	it('an edited span drops the old row and returns its files', () => {
		const { db, w } = setup();
		queueLoops(db, T);
		const id = claimLoop(db, T)!.id;
		finishLoop(db, id, T + 1);
		updateSpot(db, w.own.u1.spot, { startMs: 200, endMs: 1000 }, 'u1', T + 2);
		const out = queueLoops(db, T + 3);
		expect(out.stale.sort()).toEqual([
			`${w.own.u1.spot}-0-1000-still.jpg`,
			`${w.own.u1.spot}-0-1000.jpg`
		]);
		expect(out.queued).toBe(1);
		expect(rows(db)).toMatchObject([
			{ spotId: w.own.u1.spot, startMs: 200, endMs: 1000, status: 'queued' }
		]);
	});

	it('an unlinked section keeps its loop; a deleted spot drops it', () => {
		const { db, w } = setup();
		const link = linkInSpace(db, wall, w.own.u1.videoSpot, { figureId: w.own.u1.figure });
		queueLoops(db, T);
		unlinkSpot(db, link, { figureId: w.own.u1.figure }, T + 1);
		expect(queueLoops(db, T + 1)).toEqual({ queued: 0, stale: [] });
		expect(rows(db)).toHaveLength(2);
		deleteSpot(db, w.own.u1.videoSpot, 'u1', T + 2);
		expect(queueLoops(db, T + 3).stale).toHaveLength(2);
		expect(rows(db).map((r) => r.spotId)).toEqual([w.own.u1.spot]);
	});
});

describe('claim, source, finish, fail', () => {
	it('claim leases the oldest with its span', () => {
		const { db, w } = setup();
		queueLoops(db, T);
		const job = claimLoop(db, T);
		expect(job).toMatchObject({ startMs: 0, endMs: 1000 });
		expect(claimLoop(db, T + 1000)).toBeNull();
		expect(claimLoop(db, T + LEASE_MS + 1)?.id).toBe(job!.id);
		expect(loopSource(db, job!.id)).toMatchObject({ kind: 'recording' });
		expect(finishLoop(db, job!.id, T + 2)).toBe(`${w.own.u1.spot}-0-1000.jpg`);
		expect(rows(db)[0].status).toBe('ready');
	});

	it('gives up after MAX_ATTEMPTS', () => {
		const { db } = setup();
		queueLoops(db, T);
		for (let k = 0; k < MAX_ATTEMPTS; k++) claimLoop(db, T + k * (LEASE_MS + 1));
		expect(claimLoop(db, T + MAX_ATTEMPTS * (LEASE_MS + 1))).toBeNull();
		expect(rows(db)[0]).toMatchObject({ status: 'failed' });
	});

	it('a permanent failure stays failed; a transient one is queued again', () => {
		const { db } = setup();
		queueLoops(db, T);
		const id = claimLoop(db, T)!.id;
		failLoop(db, id, 'broken', false, T + 1);
		expect(rows(db)[0]).toMatchObject({ status: 'queued', error: 'broken' });
		failLoop(db, claimLoop(db, T + 2)!.id, 'no picture', true, T + 3);
		expect(rows(db)[0]).toMatchObject({ status: 'failed', error: 'no picture' });
		expect(claimLoop(db, T + LEASE_MS * 2)).toBeNull();
	});

	it('loopSource is null once the span changed', () => {
		const { db, w } = setup();
		queueLoops(db, T);
		const id = claimLoop(db, T)!.id;
		updateSpot(db, w.own.u1.spot, { startMs: 100, endMs: 1000 }, 'u1', T + 1);
		expect(loopSource(db, id)).toBeNull();
		expect(finishLoop(db, id, T + 2)).toBeNull();
	});
});
