import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrateDevice } from './migrate';
import { repoMigrations } from './test-migrations';
import { wipeCopy } from './apply';
import {
	applyKeepChange,
	DEFAULT_KEEP,
	keptBySpace,
	keptVideos,
	readKeep,
	spaceRows,
	wantedVideos,
	writeKeep,
	KEEP_META
} from './keep';

let db: Database.Database;
beforeEach(() => {
	db = new Database(':memory:');
	migrateDevice(db, repoMigrations());
	db.pragma('foreign_keys = OFF');
});

const U = 'u1';
let ids = 1;
function lesson(o: {
	user?: string;
	team?: number;
	day: string;
	title?: string;
	archived?: boolean;
}) {
	const id = ids++;
	db.prepare(
		`INSERT INTO lessons (id, lesson_day, user_id, team_id, title, archived_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, 0)`
	).run(id, o.day, o.user ?? null, o.team ?? null, o.title ?? `L${id}`, o.archived ? 1 : null);
	return id;
}
function video(lessonId: number, file: string, size: number) {
	db.prepare(
		`INSERT INTO lesson_videos (id, lesson_id, file, mime, size_bytes, created_at)
		 VALUES (?, ?, ?, 'video/mp4', ?, 0)`
	).run(ids++, lessonId, file, size);
}
function team(id: number, name: string, member: boolean, deleted = false) {
	db.prepare(
		`INSERT INTO teams (id, dance, name, code, created_by, created_at, deleted_at)
		 VALUES (?, 'salsa', ?, ?, 'x', 0, ?)`
	).run(id, name, `c${id}`, deleted ? 1 : null);
	if (member) {
		db.prepare(
			`INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', 0)`
		).run(id, U);
	}
}
function recording(file: string, kind: 'video' | 'audio', size: number, created: number) {
	const fig = ids++;
	db.prepare(`INSERT INTO figures (id, name, created_at) VALUES (?, ?, 0)`).run(fig, `Fig ${fig}`);
	db.prepare(
		`INSERT INTO recordings (id, figure_id, file, mime, kind, size_bytes, created_at)
		 VALUES (?, ?, ?, 'video/webm', ?, ?, ?)`
	).run(ids++, fig, file, kind, size, created);
	return fig;
}

describe('the keep settings (offline phase 4b)', () => {
	it('read with nothing stored, round trip, and garbage', () => {
		expect(readKeep(db)).toEqual(DEFAULT_KEEP);
		const s = { spaces: ['mine'], wifiOnly: false, videos: ['recordings/r.webm'] };
		writeKeep(db, s);
		expect(readKeep(db)).toEqual(s);
		db.prepare('UPDATE device_meta SET value = ? WHERE key = ?').run('{nope', KEEP_META);
		expect(readKeep(db)).toEqual(DEFAULT_KEEP);
		db.prepare('UPDATE device_meta SET value = ? WHERE key = ?').run('{"spaces":3}', KEEP_META);
		expect(readKeep(db)).toEqual(DEFAULT_KEEP);
	});

	it('another person or Forget (the copy wiped) starts from the default', () => {
		writeKeep(db, { spaces: ['mine'], wifiOnly: false, videos: [] });
		wipeCopy(db);
		expect(readKeep(db)).toEqual(DEFAULT_KEEP);
	});

	it('changes: a space, a video, Only on Wi-Fi, and Clear', () => {
		let s = applyKeepChange(DEFAULT_KEEP, { space: 'team:7', on: true });
		s = applyKeepChange(s, { space: 'team:7', on: true });
		expect(s.spaces).toEqual(['team:7']);
		s = applyKeepChange(s, { video: 'lesson-videos/a.mp4', on: true });
		expect(s.videos).toEqual(['lesson-videos/a.mp4']);
		s = applyKeepChange(s, { wifiOnly: false });
		expect(s.wifiOnly).toBe(false);
		expect(applyKeepChange(s, { space: 'team:7', on: false }).spaces).toEqual([]);
		expect(applyKeepChange(s, { video: 'lesson-videos/a.mp4', on: false }).videos).toEqual([]);
		expect(applyKeepChange(s, { clear: true })).toEqual({
			spaces: [],
			wifiOnly: false,
			videos: []
		});
	});
});

describe('what the phone keeps', () => {
	beforeEach(() => {
		team(7, 'Salsa za začetnike', true);
		team(9, 'Not mine', false);
		team(11, 'Gone', true, true);
		const own = lesson({ user: U, day: '2026-11-01', title: 'Marmelada' });
		video(own, 'a.mp4', 100);
		const old = lesson({ user: U, day: '2026-10-01', archived: true });
		video(old, 'archived.mp4', 5);
		const group = lesson({ team: 7, day: '2026-11-05' });
		video(group, 'b.mp4', 200);
		video(lesson({ team: 9, day: '2026-11-06' }), 'c.mp4', 300);
		video(lesson({ team: 11, day: '2026-11-07' }), 'd.mp4', 400);
		recording('r.webm', 'video', 50, 10);
		recording('voice.webm', 'audio', 7, 11);
	});

	it("the switched-on spaces' videos newest first, then kept recordings, each with its size", () => {
		const got = wantedVideos(db, U, {
			spaces: ['mine', 'team:7', 'team:9'],
			wifiOnly: true,
			videos: ['recordings/r.webm', 'recordings/voice.webm', 'recordings/gone.webm']
		});
		expect(got).toEqual([
			{ kind: 'lesson-videos', file: 'b.mp4', mime: 'video/mp4', size: 200 },
			{ kind: 'lesson-videos', file: 'a.mp4', mime: 'video/mp4', size: 100 },
			{ kind: 'recordings', file: 'r.webm', mime: 'video/webm', size: 50 }
		]);
	});

	it('a video kept by itself and by its space comes once', () => {
		const got = wantedVideos(db, U, {
			spaces: ['mine'],
			wifiOnly: true,
			videos: ['lesson-videos/a.mp4', 'lesson-videos/b.mp4']
		});
		expect(got.map((f) => f.file)).toEqual(['b.mp4', 'a.mp4']);
	});

	it('the spaces: My lessons first, then the groups the person is in', () => {
		const rows = spaceRows(
			db,
			U,
			{ spaces: ['mine'], wifiOnly: true, videos: [] },
			new Set(['lesson-videos/a.mp4'])
		);
		expect(rows).toEqual([
			{ id: 'mine', name: null, on: true, videos: 1, bytes: 100, held: 1, heldBytes: 100 },
			{
				id: 'team:7',
				name: 'Salsa za začetnike',
				on: false,
				videos: 1,
				bytes: 200,
				held: 0,
				heldBytes: 0
			}
		]);
	});

	it('kept videos are named by their lesson and place, or their figure', () => {
		const second = lesson({ user: U, day: '2026-11-02', title: 'Dve' });
		video(second, 'first.mp4', 1);
		video(second, 'second.mp4', 2);
		const got = keptVideos(
			db,
			{
				spaces: [],
				wifiOnly: true,
				videos: ['lesson-videos/second.mp4', 'recordings/r.webm', 'recordings/gone.webm']
			},
			new Set(['recordings/r.webm'])
		);
		expect(got).toEqual([
			{ key: 'lesson-videos/second.mp4', title: 'Dve', index: 2, bytes: 2, held: false },
			{
				key: 'recordings/r.webm',
				title: expect.stringMatching(/^Fig /),
				index: null,
				bytes: 50,
				held: true
			}
		]);
	});

	it('which kept videos a space keeps', () => {
		expect(keptBySpace(db, U, { spaces: ['team:7'], wifiOnly: true, videos: [] })).toEqual({
			'lesson-videos/b.mp4': 'team:7'
		});
	});
});
