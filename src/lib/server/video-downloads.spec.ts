import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { videoDownloads } from './db/schema';
import { createCustomExercise } from './exercises';
import { createFigure, getFigure } from './figures';
import { createLesson, getLesson } from './lessons';
import { addLinks, deleteLink, listLinks, type LinkOwner } from './links';
import { listSpots } from './spots';
import { LEASE_MS, MAX_ATTEMPTS } from './songs';
import {
	claimVideoJob,
	completeVideoJob,
	failVideoJob,
	requestVideoDownload,
	retryVideoDownload
} from './video-downloads';

const YT = 'https://youtu.be/dQw4w9WgXcQ';
const T = 1_800_000_000_000;
const FILE = { file: 'a.mp4', mime: 'video/mp4', sizeBytes: 1234 };
let db: Db;
let figureId: number;
let lessonId: number;

beforeEach(() => {
	db = openDb(':memory:');
	figureId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-14', title: 'Class', notes: null })
		.lesson.id;
});

const linkOn = (owner: LinkOwner, url = YT) => addLinks(db, owner, [url], null)![0].id;
const jobs = () => db.select().from(videoDownloads).all();

describe('requestVideoDownload', () => {
	it('queues a YouTube link once, and the link shows it as saving', () => {
		const id = linkOn({ figureId });
		expect(listLinks(db, { figureId })[0].saving).toBeNull();
		expect(requestVideoDownload(db, { figureId }, id)).toBe('ok');
		expect(requestVideoDownload(db, { figureId }, id)).toBe('ok');
		expect(jobs()).toHaveLength(1);
		expect(listLinks(db, { figureId })[0].saving).toEqual({ status: 'queued', error: null });
	});

	it('refuses a web link, another page’s link, and a drill’s link', () => {
		const web = linkOn({ figureId }, 'https://a.org/x');
		expect(requestVideoDownload(db, { figureId }, web)).toBe('not-youtube');
		const onLesson = linkOn({ lessonId });
		expect(requestVideoDownload(db, { figureId }, onLesson)).toBe('not-found');
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 2, notes: null });
		const d = linkOn({ exerciseId: drill.id });
		expect(requestVideoDownload(db, { exerciseId: drill.id }, d)).toBe('not-found');
		expect(jobs()).toEqual([]);
	});

	it('leaves a failed job failed; Retry queues it again', () => {
		const id = linkOn({ figureId });
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		failVideoJob(db, job.id, 'Video unavailable', true);
		requestVideoDownload(db, { figureId }, id);
		expect(listLinks(db, { figureId })[0].saving).toEqual({
			status: 'failed',
			error: 'Video unavailable'
		});
		expect(retryVideoDownload(db, { lessonId }, id)).toBe(false);
		expect(retryVideoDownload(db, { figureId }, id)).toBe(true);
		expect(listLinks(db, { figureId })[0].saving).toEqual({ status: 'queued', error: null });
		expect(claimVideoJob(db, T)?.id).toBe(job.id);
	});
});

describe('claimVideoJob and failVideoJob', () => {
	it('leases, retakes a stale claim, and gives up after MAX_ATTEMPTS', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		let now = T;
		expect(claimVideoJob(db, now)).toEqual({ id: expect.any(Number), url: YT });
		expect(claimVideoJob(db, now + LEASE_MS - 1)).toBeNull();
		for (let i = 1; i < MAX_ATTEMPTS; i++) {
			now += LEASE_MS + 1;
			expect(claimVideoJob(db, now)).not.toBeNull();
		}
		now += LEASE_MS + 1;
		expect(claimVideoJob(db, now)).toBeNull();
		expect(listLinks(db, { lessonId })[0].saving?.status).toBe('failed');
	});

	it('keeps a transient failure queued under its lease', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		const job = claimVideoJob(db, T)!;
		failVideoJob(db, job.id, 'HTTP Error 503', false);
		expect(listLinks(db, { lessonId })[0].saving).toEqual({
			status: 'queued',
			error: 'HTTP Error 503'
		});
		expect(claimVideoJob(db, T + 1)).toBeNull();
	});
});

describe('completeVideoJob', () => {
	it('turns a figure link into a recording with its source and a start spot', () => {
		const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90';
		const id = linkOn({ figureId }, url);
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		expect(completeVideoJob(db, job.id, FILE)).toEqual({ recordingId: expect.any(Number) });
		const [rec] = getFigure(db, figureId)!.recordings;
		expect(rec).toMatchObject({ file: 'a.mp4', kind: 'video', sourceUrl: url, sizeBytes: 1234 });
		expect(listLinks(db, { figureId })).toEqual([]);
		expect(jobs()).toEqual([]);
		expect(listSpots(db, { recordingId: rec.id })).toMatchObject([
			{ startMs: 90_000, endMs: null }
		]);
	});

	it('turns a lesson link into a lesson video, with no spot when there is no start', () => {
		const id = linkOn({ lessonId });
		requestVideoDownload(db, { lessonId }, id);
		const job = claimVideoJob(db, T)!;
		const done = completeVideoJob(db, job.id, FILE) as { lessonVideoId: number };
		expect(getLesson(db, lessonId)!.videos[0]).toMatchObject({
			id: done.lessonVideoId,
			sourceUrl: YT
		});
		expect(listSpots(db, { lessonVideoId: done.lessonVideoId })).toEqual([]);
	});

	it('is null for a job that is gone; removing the link cancels its job', () => {
		const id = linkOn({ figureId });
		requestVideoDownload(db, { figureId }, id);
		const job = claimVideoJob(db, T)!;
		expect(deleteLink(db, { lessonId }, id)).toBe(false);
		expect(deleteLink(db, { figureId }, id)).toBe(true);
		expect(db.select().from(videoDownloads).where(eq(videoDownloads.id, job.id)).all()).toEqual([]);
		expect(completeVideoJob(db, job.id, FILE)).toBeNull();
		expect(getFigure(db, figureId)!.recordings).toEqual([]);
	});
});
