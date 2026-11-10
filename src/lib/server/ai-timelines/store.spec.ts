import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { lessonVideos, recordings, videoSpots } from '../db/schema';
import { makeWorld, type World } from '../sync/test-world';
import {
	askTimeline,
	claimTimeline,
	failTimeline,
	finishTimeline,
	sweepTimelines,
	timelineOf,
	timelineSource,
	touchTimeline
} from './store';

const T = 1_800_000_000_000;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}

describe('askTimeline', () => {
	it('queues once', () => {
		const { db, w } = setup();
		const video = { lessonVideoId: w.own.u1.video };
		const a = askTimeline(db, video, T);
		const b = askTimeline(db, video, T + 1000);
		expect(b.id).toBe(a.id);
		expect(b.status).toBe('queued');
	});

	it('a failed one is asked again after a day', () => {
		const { db, w } = setup();
		const video = { recordingId: w.own.u1.recording };
		const t = askTimeline(db, video, T);
		failTimeline(db, t.id, 'broken', true, T);
		expect(askTimeline(db, video, T + HOUR)).toMatchObject({ status: 'failed', error: 'broken' });
		expect(askTimeline(db, video, T + 25 * HOUR)).toMatchObject({ status: 'queued', error: null });
	});
});

describe('claim and finish', () => {
	it('claim, finish, ready', () => {
		const { db, w } = setup();
		const t = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		expect(claimTimeline(db, T)).toEqual({ id: t.id });
		expect(claimTimeline(db, T + 1000)).toBeNull();
		expect(finishTimeline(db, t.id, 3, 150_000, T + 2000)).toBe(true);
		expect(timelineOf(db, { lessonVideoId: w.own.u1.video })).toMatchObject({
			status: 'ready',
			pieces: 3,
			durationMs: 150_000,
			usedAt: T + 2000
		});
		expect(claimTimeline(db, T + DAY)).toBeNull();
	});

	it('a transient failure stays queued; a permanent one fails', () => {
		const { db, w } = setup();
		const t = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		claimTimeline(db, T);
		failTimeline(db, t.id, 'network', false, T);
		expect(timelineOf(db, { lessonVideoId: w.own.u1.video })?.status).toBe('queued');
		failTimeline(db, t.id, 'not a video', true, T);
		expect(timelineOf(db, { lessonVideoId: w.own.u1.video })).toMatchObject({
			status: 'failed',
			error: 'not a video'
		});
		expect(finishTimeline(db, t.id, 1, 1000, T)).toBe(false);
	});
});

describe('timelineSource', () => {
	it('is the video file, null for an audio recording and for a gone video', () => {
		const { db, w } = setup();
		const lv = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		expect(timelineSource(db, lv.id)).toMatchObject({
			kind: 'lesson-video',
			file: expect.any(String)
		});
		const rec = askTimeline(db, { recordingId: w.own.u1.recording }, T);
		db.update(recordings).set({ kind: 'audio' }).where(eq(recordings.id, w.own.u1.recording)).run();
		expect(timelineSource(db, rec.id)).toBeNull();
		db.delete(videoSpots).where(eq(videoSpots.lessonVideoId, w.own.u1.video)).run();
		db.delete(lessonVideos).where(eq(lessonVideos.id, w.own.u1.video)).run();
		expect(timelineSource(db, lv.id)).toBeNull();
	});
});

describe('timelineSource: a phone-only video (offline phase 4c)', () => {
	it('has no file here: null, a queued timeline is not cut', () => {
		const { db, w } = setup();
		const lv = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		db.update(lessonVideos)
			.set({ serverCopy: false })
			.where(eq(lessonVideos.id, w.own.u1.video))
			.run();
		expect(timelineSource(db, lv.id)).toBeNull();
		const rec = askTimeline(db, { recordingId: w.own.u1.recording }, T);
		db.update(recordings)
			.set({ serverCopy: false })
			.where(eq(recordings.id, w.own.u1.recording))
			.run();
		expect(timelineSource(db, rec.id)).toBeNull();
	});
});

describe('the sweep', () => {
	it('drops timelines unused for 30 days and those whose video is gone', () => {
		const { db, w } = setup();
		const old = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		claimTimeline(db, T);
		finishTimeline(db, old.id, 1, 1000, T);
		const fresh = askTimeline(db, { recordingId: w.own.u1.recording }, T);
		claimTimeline(db, T);
		finishTimeline(db, fresh.id, 1, 1000, T);
		touchTimeline(db, fresh.id, T + 30 * DAY);
		const orphan = askTimeline(db, { lessonVideoId: w.own.u4.video }, T + 30 * DAY);
		db.delete(videoSpots).where(eq(videoSpots.lessonVideoId, w.own.u4.video)).run();
		db.delete(lessonVideos).where(eq(lessonVideos.id, w.own.u4.video)).run();

		expect(sweepTimelines(db, T + 31 * DAY).sort()).toEqual([old.id, orphan.id].sort());
		expect(timelineOf(db, { recordingId: w.own.u1.recording })?.id).toBe(fresh.id);
	});

	it('touch rewrites used_at at most hourly', () => {
		const { db, w } = setup();
		const t = askTimeline(db, { lessonVideoId: w.own.u1.video }, T);
		claimTimeline(db, T);
		finishTimeline(db, t.id, 1, 1000, T);
		touchTimeline(db, t.id, T + 10 * 60_000);
		expect(timelineOf(db, { lessonVideoId: w.own.u1.video })?.usedAt).toBe(T);
		touchTimeline(db, t.id, T + 2 * HOUR);
		expect(timelineOf(db, { lessonVideoId: w.own.u1.video })?.usedAt).toBe(T + 2 * HOUR);
	});
});
