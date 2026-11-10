/**
 * The AI's video tools on an in-memory db and a temp `$DATA_DIR` (mocked,
 * never set through `process.env` — see CLAUDE.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));

import { openDb, type Db } from '../db';
import { makeWorld, type World } from '../sync/test-world';
import { askTimeline, claimTimeline, finishTimeline, timelineDir } from '../ai-timelines/store';
import { writePiece } from '../ai-timelines/files';
import { noteWorkerSeen, resetWorkerSeen } from '../worker-seen';
import { videoTools } from './video';
import type { ToolCtx } from './modules';

const NOW = 1_800_000_000_000;
let db: Db;
let w: World;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-video-tools-'));
	db = openDb(':memory:');
	w = makeWorld(db);
	resetWorkerSeen();
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const ctx = (userId = 'u1'): ToolCtx => ({ db, userId, dance: 'salsa', grantId: 1, now: NOW });
async function call(name: string, args: Record<string, unknown>, userId = 'u1') {
	const r = await videoTools.impls[name](args, ctx(userId));
	return { ...r, data: r.isError ? null : JSON.parse(r.text) };
}

/** A ready timeline of `durationMs` with a frame every 2 s and, unless silent, sound in each piece. */
async function ready(
	video: { lessonVideoId: number } | { recordingId: number },
	durationMs: number,
	silent = false
) {
	const t = askTimeline(db, video, NOW - 1000);
	claimTimeline(db, NOW - 1000);
	const pieces = Math.ceil(durationMs / 60_000);
	for (let k = 0; k < pieces; k++) {
		const frames = [];
		for (let t = k * 60_000; t < Math.min((k + 1) * 60_000, durationMs); t += 2000)
			frames.push({ tMs: t, data: Buffer.from(`f${t}`).toString('base64') });
		await writePiece(timelineDir(t.id), k, {
			frames,
			sound: silent ? null : Buffer.from(`s${k}`).toString('base64')
		});
	}
	finishTimeline(db, t.id, pieces, durationMs, NOW - 1000);
	return t;
}

/** Row counts of every table but SQLite's own. */
function counts(): Record<string, number> {
	const tables = db.all<{ name: string }>(
		sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'`
	);
	return Object.fromEntries(
		tables.map((t) => [
			t.name,
			db.get<{ n: number }>(sql`select count(*) as n from ${sql.identifier(t.name)}`)!.n
		])
	);
}

describe('video_timeline', () => {
	it('writes only ai_timelines', async () => {
		const before = counts();
		await call('video_timeline', { lesson_video_id: w.own.u1.video });
		const after = counts();
		const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
		expect(changed.filter((k) => k !== 'id_marks')).toEqual(['ai_timelines']);
		expect(after.ai_timelines - before.ai_timelines).toBe(1);
	});

	it('preparing, then offline', async () => {
		const first = await call('video_timeline', { lesson_video_id: w.own.u1.video });
		expect(first.data.status).toBe('preparing');
		noteWorkerSeen(NOW - 16 * 60_000);
		const again = await call('video_timeline', { lesson_video_id: w.own.u1.video });
		expect(again.data.status).toBe('worker offline');
	});

	it('a ready stretch', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const r = await call('video_timeline', {
			lesson_video_id: w.own.u1.video,
			from_s: 50,
			to_s: 70
		});
		expect(r.isError).toBe(false);
		expect(r.data.frames_s).toEqual([50, 52, 54, 56, 58, 60, 62, 64, 66, 68]);
		expect(r.images?.length).toBe(10);
		expect(r.images?.[0]).toEqual({
			data: Buffer.from('f50000').toString('base64'),
			mimeType: 'image/jpeg'
		});
		expect(r.audio ?? []).toEqual([]);
		expect(r.data.sound).toBe('off');
		expect(r.data.next_from_s).toBe(70);
		expect(r.data.video).toMatchObject({ duration_s: 150 });
	});

	it('every_s skims', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const r = await call('video_timeline', {
			lesson_video_id: w.own.u1.video,
			from_s: 0,
			to_s: 150,
			every_s: 6
		});
		expect(r.data.frames_s).toHaveLength(25);
		expect(r.data.frames_s.slice(0, 3)).toEqual([0, 6, 12]);
	});

	it('more than 30 frames is refused', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const r = await call('video_timeline', {
			lesson_video_id: w.own.u1.video,
			from_s: 0,
			to_s: 90
		});
		expect(r.isError).toBe(true);
		expect(r.text).toMatch(/30 frames/);
	});

	it('sound', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const r = await call('video_timeline', {
			lesson_video_id: w.own.u1.video,
			from_s: 50,
			to_s: 70,
			sound: true
		});
		expect(r.audio).toHaveLength(2);
		expect(r.audio?.[1]).toEqual({
			data: Buffer.from('s1').toString('base64'),
			mimeType: 'audio/mpeg'
		});
		expect(r.data.sound).toEqual([
			{ from_s: 0, to_s: 60 },
			{ from_s: 60, to_s: 120 }
		]);
		const long = await call('video_timeline', {
			lesson_video_id: w.own.u1.video,
			from_s: 0,
			to_s: 90,
			every_s: 4,
			sound: true
		});
		expect(long.isError).toBe(true);
		expect(long.text).toMatch(/at most 60 s/);
	});

	it('sound on a silent video', async () => {
		await ready({ recordingId: w.own.u1.recording }, 30_000, true);
		const r = await call('video_timeline', { recording_id: w.own.u1.recording, sound: true });
		expect(r.data.sound).toBe('none on this video');
		expect(r.audio ?? []).toEqual([]);
		expect(r.images).toHaveLength(15);
	});

	it('stretch past the end', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const past = await call('video_timeline', { lesson_video_id: w.own.u1.video, from_s: 150 });
		expect(past.isError).toBe(true);
		expect(past.text).toMatch(/150 s long/);
		const last = await call('video_timeline', { lesson_video_id: w.own.u1.video, from_s: 140 });
		expect(last.data.to_s).toBe(150);
		expect(last.data.next_from_s).toBeNull();
		expect(last.data.frames_s).toEqual([140, 142, 144, 146, 148]);
	});

	it('blind leaves out this video`s sections; your_sections are own spans on other videos', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		const seen = await call('video_timeline', { lesson_video_id: w.own.u1.video });
		expect(seen.data.sections_here.map((s: { label: string }) => s.label)).toEqual(['Part']);
		const labels = seen.data.your_sections.map((s: { label: string }) => s.label);
		expect(labels).toContain('Turn');
		expect(labels).not.toContain('Part');
		expect(labels).not.toContain('Class turn');
		const blind = await call('video_timeline', { lesson_video_id: w.own.u1.video, blind: true });
		expect(blind.data.sections_here).toBeUndefined();
	});

	it("another person's video is missing", async () => {
		const theirs = await call('video_timeline', { lesson_video_id: w.own.u4.video });
		const none = await call('video_timeline', { lesson_video_id: 999_999 });
		expect(theirs.isError).toBe(true);
		expect(theirs.text).toBe(none.text);
		expect(counts().ai_timelines).toBe(0);
	});

	it('takes exactly one video id, and nothing else', async () => {
		expect((await call('video_timeline', {})).isError).toBe(true);
		expect(
			(await call('video_timeline', { lesson_video_id: w.own.u1.video, recording_id: 1 })).isError
		).toBe(true);
		expect(
			(await call('video_timeline', { lesson_video_id: w.own.u1.video, every_s: 3 })).isError
		).toBe(true);
		expect((await call('video_timeline', { lesson_video_id: w.own.u1.video, x: 1 })).isError).toBe(
			true
		);
	});
});

describe('videos', () => {
	it('lists readable videos with their timeline state and the worker', async () => {
		await ready({ lessonVideoId: w.own.u1.video }, 150_000);
		noteWorkerSeen(NOW - 60_000);
		const r = await call('videos', {});
		expect(r.data.worker).toBe('online');
		const lv = r.data.videos.find(
			(v: { lesson_video_id?: number }) => v.lesson_video_id === w.own.u1.video
		);
		expect(lv).toMatchObject({ owner: 'mine', sections: 1, timeline: 'ready', duration_s: 150 });
		const rec = r.data.videos.find(
			(v: { recording_id?: number }) => v.recording_id === w.own.u1.recording
		);
		expect(rec).toMatchObject({ timeline: 'not prepared' });
		expect(
			r.data.videos.some((v: { lesson_video_id?: number }) => v.lesson_video_id === w.own.u4.video)
		).toBe(false);
	});
});

describe('a phone-only video (offline phase 4c)', () => {
	const phoneOnly = () =>
		db.run(
			sql`update lesson_videos set server_copy = 0, origin_slot = 3 where id = ${w.own.u1.video}`
		);

	it('video_timeline says it is on a device, and queues nothing', async () => {
		phoneOnly();
		db.run(
			sql`insert into device_slots (slot, device_key, user_id, created_at, label) values (3, 'k3', 'u1', 1, '{"kind":"android","model":"Pixel 8"}')`
		);
		const before = counts();
		const r = await call('video_timeline', { lesson_video_id: w.own.u1.video });
		expect(r.data).toMatchObject({
			status: 'on a device',
			device: { kind: 'android', model: 'Pixel 8' }
		});
		expect(counts()).toEqual(before);
	});

	it('videos marks it', async () => {
		phoneOnly();
		const r = await call('videos', {});
		const row = r.data.videos.find(
			(x: { lesson_video_id?: number }) => x.lesson_video_id === w.own.u1.video
		);
		expect(row.on_device).toBe(true);
	});
});
