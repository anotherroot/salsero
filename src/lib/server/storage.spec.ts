import { beforeEach, describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { openDb, type Db } from './db';
import { eq } from 'drizzle-orm';
import { songs, storageRequests, teams, teamTrash, users } from './db/schema';
import { createTeam, joinTeam } from './teams';
import { addRecording, archiveVariation, createFigure } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createSongFromUpload } from './songs';
import { putCountTake } from './countTakes';
import { T1_SALSA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';
import {
	askForMore,
	adminReaches,
	listOpenRequests,
	listPeople,
	listStorageItems,
	openRequest,
	resolveRequest,
	limitOf,
	limitsTotal,
	listTeamStorageItems,
	listTeamsForAdmin,
	ownerOfRow,
	setGroupLimit,
	setTeamLimit,
	roomFor,
	roomForOwner,
	teamLimitBytes,
	usedBytesOf,
	setStorageLimit,
	storageOf,
	usedBytes
} from './storage';

const MB = 1024 * 1024;
const GB = 1024 * MB;
let db: Db;

function user(id: string, limit: number | null) {
	db.insert(users)
		.values({
			id,
			email: `${id}@example.com`,
			passwordHash: 'x',
			storageLimitBytes: limit,
			dance: 'salsa'
		})
		.run();
}

function recording(wall: Space, name: string, bytes: number) {
	const f = createFigure(db, wall, {
		figureName: name,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	addRecording(
		db,
		{
			figureId: f.figure.id,
			file: `${name}.mp4`,
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: bytes,
			note: null
		},
		'u1'
	);
	return f.figure.id;
}

function take(userId: string, bpm: number, bytes: number, file: string) {
	putCountTake(db, userId, {
		pattern: 'salsa-on1' as never,
		bpm,
		phrase: 'a',
		file,
		sampleRate: 44100,
		preRollS: 0,
		lengthS: 1,
		durationS: 1,
		sizeBytes: bytes
	});
}

beforeEach(() => {
	db = openDb(':memory:');
	user('u1', 1024 * MB);
	user('u2', null);
});

describe('usedBytes', () => {
	it('sums recordings, lesson videos, songs and count takes for one person only', () => {
		recording(U1_SALSA, 'A', 1 * MB);
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 2 * MB
		});
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 't',
			style: 'son',
			sizeBytes: 4 * MB
		});
		take('u1', 100, 8 * MB, 't.wav');
		recording(U2_SALSA, 'B', 100 * MB);
		expect(usedBytes(db, 'u1')).toBe(15 * MB);
		expect(usedBytes(db, 'u2')).toBe(100 * MB);
	});

	it('counts a recording whose figure is archived', () => {
		const id = recording(U1_SALSA, 'A', 3 * MB);
		archiveVariation(db, id, 1);
		expect(usedBytes(db, 'u1')).toBe(3 * MB);
	});

	it('counts a song with no recorded size as zero', () => {
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 't',
			style: 'son'
		});
		expect(usedBytes(db, 'u1')).toBe(0);
	});
});

describe('roomFor', () => {
	it('is always ok with no limit', () => {
		recording(U2_SALSA, 'B', 5000 * MB);
		expect(roomFor(db, 'u2', 10 ** 12)).toEqual({ ok: true });
		expect(storageOf(db, 'u2')).toEqual({ usedBytes: 5000 * MB, limitBytes: null });
	});

	it('refuses an upload that crosses the limit, with the message', () => {
		recording(U1_SALSA, 'A', 900 * MB);
		const r = roomFor(db, 'u1', 200 * MB);
		expect(r).toEqual({
			ok: false,
			usedBytes: 900 * MB,
			limitBytes: 1024 * MB,
			message:
				'Not enough room: you use 900 MB of 1.0 GB. Free some space or ask for more in Settings.'
		});
		expect(roomFor(db, 'u1', 100 * MB)).toEqual({ ok: true });
	});

	it('refuses even a zero-byte ask when already over', () => {
		recording(U1_SALSA, 'A', 1100 * MB);
		expect(roomFor(db, 'u1', 0).ok).toBe(false);
	});
});

describe("a group's room", () => {
	/** Team 1 owned by u1 with u2 and u3: three people. */
	function team() {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('no team');
		joinTeam(db, 'u2', made.teamId, 2);
		joinTeam(db, 'u3', made.teamId, 2);
		return made.teamId;
	}

	it("counts its recordings, lesson videos and unpurged trash; a person's usage leaves them out", () => {
		const teamId = team();
		recording(T1_SALSA, 'Team', 10 * MB);
		const lesson = createLesson(db, T1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(
			db,
			{
				lessonId: lesson.id,
				file: 'tv.mp4',
				mime: 'video/mp4',
				sizeBytes: 20 * MB
			},
			'u1'
		);
		const trash = (sizeBytes: number, more: { purgedAt?: number; restoredAt?: number } = {}) =>
			db
				.insert(teamTrash)
				.values({
					teamId,
					kind: 'video',
					label: 'x',
					rootKind: 'lesson',
					rootId: lesson.id,
					rowsJson: '[]',
					sizeBytes,
					deletedBy: 'u1',
					deletedAt: 1,
					...more
				})
				.run();
		trash(40 * MB);
		trash(80 * MB, { purgedAt: 2 });
		trash(160 * MB, { restoredAt: 2 });
		recording(U1_SALSA, 'Mine', 1 * MB);

		expect(usedBytesOf(db, { teamId })).toBe(70 * MB);
		expect(usedBytesOf(db, { userId: 'u1' })).toBe(1 * MB);
		expect(usedBytes(db, 'u1')).toBe(1 * MB);
	});

	it('a group of three may keep 600 MB; the admin’s override wins', () => {
		const teamId = team();
		expect(teamLimitBytes(db, teamId)).toBe(600 * MB);
		expect(limitOf(db, { teamId })).toBe(600 * MB);
		db.update(teams)
			.set({ storageLimitBytes: 50 * MB })
			.where(eq(teams.id, teamId))
			.run();
		expect(teamLimitBytes(db, teamId)).toBe(50 * MB);
	});

	it("refuses an upload over the group's limit with the group's message", () => {
		const teamId = team();
		recording(T1_SALSA, 'Team', 550 * MB);
		expect(roomForOwner(db, { teamId }, 100 * MB, 100 * GB)).toEqual({
			ok: false,
			usedBytes: 550 * MB,
			limitBytes: 600 * MB,
			message: 'Not enough room: the group uses 550 MB of 600 MB. The owner can ask for more.'
		});
		expect(roomForOwner(db, { teamId }, 50 * MB, 100 * GB)).toEqual({ ok: true });
	});
});

describe("a group's songs", () => {
	beforeEach(() => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	});
	const song = (file: string, sizeBytes: number) =>
		createSongFromUpload(db, T1_SALSA, {
			file,
			mime: 'audio/mpeg',
			title: file,
			style: 'salsa',
			sizeBytes
		});

	it("count against the group, archived too, and never the person's", () => {
		const before = usedBytes(db, 'u1');
		song('a.mp3', 10);
		expect(usedBytesOf(db, { teamId: 1 })).toBe(10);
		const b = song('b.mp3', 5);
		db.update(songs).set({ archivedAt: 3 }).where(eq(songs.id, b.id)).run();
		expect(usedBytesOf(db, { teamId: 1 })).toBe(15);
		expect(usedBytes(db, 'u1')).toBe(before);
		expect(listStorageItems(db, 'u1')).toEqual([]);
	});

	it("show in the group's storage items", () => {
		const s = song('a.mp3', 10);
		expect(listTeamStorageItems(db, 1)).toEqual([
			expect.objectContaining({ kind: 'song', id: s.id, sizeBytes: 10, archived: false })
		]);
	});
});

describe('the disk floor', () => {
	it('refuses a 200 MB upload with 2.1 GB free, even with no limit', () => {
		expect(limitOf(db, { userId: 'u2' })).toBeNull();
		const r = roomForOwner(db, { userId: 'u2' }, 200 * MB, 2.1 * GB);
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.message).toBe('Not enough room on the server. Ask the admin.');
		expect(roomForOwner(db, { userId: 'u2' }, 50 * MB, 2.1 * GB)).toEqual({ ok: true });
	});
});

describe('listStorageItems', () => {
	it('lists the person’s files biggest first, attributed, with archived marked', () => {
		const figId = recording(U1_SALSA, 'Enchufla', 3 * MB);
		recording(U2_SALSA, 'Other', 99 * MB);
		archiveVariation(db, figId, 1);
		const lesson = createLesson(db, U1_SALSA, {
			title: '15 salsa cubana moves',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 9 * MB
		});
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 'Song A',
			style: 'son',
			sizeBytes: 5 * MB
		});
		take('u1', 100, 1 * MB, 't.wav');
		take('u1', 110, 1 * MB, 't2.wav');
		const items = listStorageItems(db, 'u1');
		expect(items.map((i) => [i.kind, i.sizeBytes])).toEqual([
			['lessonVideo', 9 * MB],
			['song', 5 * MB],
			['recording', 3 * MB],
			['voice', 2 * MB]
		]);
		expect(items[0]).toMatchObject({
			title: 'Lesson video',
			context: 'Lesson · 15 salsa cubana moves'
		});
		expect(items[2]).toMatchObject({ context: 'Enchufla · Basic', archived: true, href: null });
		expect(items[3]).toMatchObject({ id: null, href: '/voice', archived: false });
		expect(items[0].href).toBe(`/salsa/lessons/${lesson.id}`);
	});

	it('has no voice row without takes', () => {
		expect(listStorageItems(db, 'u1')).toEqual([]);
	});
});

describe('askForMore', () => {
	it('opens one request per person; a second ask says so', () => {
		expect(askForMore(db, { userId: 'u1' }, ' more please ', 1000)).toBe('asked');
		expect(openRequest(db, 'u1')).toEqual({ createdAt: 1000, note: 'more please' });
		expect(askForMore(db, { userId: 'u1' }, null, 2000)).toBe('already-open');
		expect(openRequest(db, 'u2')).toBeNull();
		expect(askForMore(db, { userId: 'u2' }, '  ', 3000)).toBe('asked');
		expect(openRequest(db, 'u2')).toEqual({ createdAt: 3000, note: null });
	});

	it('a resolved request does not block a new one', () => {
		askForMore(db, { userId: 'u1' }, null, 1000);
		db.update(storageRequests).set({ resolvedAt: 1500, outcome: 'declined' }).run();
		expect(openRequest(db, 'u1')).toBeNull();
		expect(askForMore(db, { userId: 'u1' }, null, 2000)).toBe('asked');
	});
});

describe('admin: people, limits and requests', () => {
	beforeEach(() => {
		db = openDb(':memory:');
		user('a', 1 * GB);
		user('b', null);
	});

	it('listPeople and listOpenRequests expose numbers and email only', () => {
		recording(U1_SALSA, 'Secret figure', 5 * MB);
		askForMore(db, { userId: 'a' }, 'a note', 5);
		expect(Object.keys(listPeople(db, 'salsa')[0]).sort()).toEqual(
			['createdAt', 'email', 'id', 'isAdmin', 'limitBytes', 'usedBytes'].sort()
		);
		expect(Object.keys(listOpenRequests(db, 'salsa')[0]).sort()).toEqual(
			[
				'createdAt',
				'email',
				'id',
				'limitBytes',
				'note',
				'teamId',
				'teamName',
				'usedBytes',
				'userId'
			].sort()
		);
		expect(listOpenRequests(db, 'salsa')[0]).toMatchObject({
			email: 'a@example.com',
			limitBytes: GB
		});
	});

	it('granting sets the limit and closes the request; settings sees none open', () => {
		askForMore(db, { userId: 'a' }, null, 5);
		const [req] = listOpenRequests(db, 'salsa');
		expect(resolveRequest(db, req.id, 'granted', 2 * GB, 9)).toBe(true);
		expect(storageOf(db, 'a').limitBytes).toBe(2 * GB);
		expect(listOpenRequests(db, 'salsa')).toEqual([]);
		expect(openRequest(db, 'a')).toBeNull();
		expect(askForMore(db, { userId: 'a' }, null, 10)).toBe('asked');
		const row = db.select().from(storageRequests).all()[0];
		expect(row).toMatchObject({ outcome: 'granted', grantedLimitBytes: 2 * GB, resolvedAt: 9 });
	});

	it('declining closes it and leaves the limit', () => {
		askForMore(db, { userId: 'a' }, null, 5);
		const [req] = listOpenRequests(db, 'salsa');
		expect(resolveRequest(db, req.id, 'declined', null, 9)).toBe(true);
		expect(storageOf(db, 'a').limitBytes).toBe(GB);
		expect(db.select().from(storageRequests).all()[0].outcome).toBe('declined');
		expect(resolveRequest(db, req.id, 'granted', 2 * GB, 10)).toBe(false);
	});

	it('refuses bad limits and unknown ids', () => {
		askForMore(db, { userId: 'a' }, null, 5);
		const [req] = listOpenRequests(db, 'salsa');
		for (const bad of [0, -5, 1.5, NaN, null]) {
			expect(resolveRequest(db, req.id, 'granted', bad as number, 9)).toBe(false);
		}
		expect(listOpenRequests(db, 'salsa')).toHaveLength(1);
		expect(setStorageLimit(db, 'a', 0)).toBe(false);
		expect(setStorageLimit(db, 'a', 2.5)).toBe(false);
		expect(setStorageLimit(db, 'nobody', GB)).toBe(false);
		expect(setStorageLimit(db, 'a', null)).toBe(true);
		expect(storageOf(db, 'a').limitBytes).toBeNull();
		expect(setStorageLimit(db, 'a', 3 * GB)).toBe(true);
		expect(storageOf(db, 'a').limitBytes).toBe(3 * GB);
	});
});

describe('groups: requests, limits and the admin numbers', () => {
	beforeEach(() => {
		db = openDb(':memory:');
		user('u1', 1024 * MB);
		user('u2', 1024 * MB);
		user('u3', null);
	});

	function team() {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('no team');
		joinTeam(db, 'u2', made.teamId, 2);
		joinTeam(db, 'u3', made.teamId, 2);
		return made.teamId;
	}

	it('limitsTotal adds every person limit and a group of 3 with no override', () => {
		team();
		expect(limitsTotal(db)).toBe(2 * 1024 * MB + 600 * MB);
	});

	it('limitsTotal uses a group override, and leaves out a purged group', () => {
		const teamId = team();
		expect(setTeamLimit(db, teamId, 50 * MB)).toBe(true);
		expect(limitsTotal(db)).toBe(2 * 1024 * MB + 50 * MB);
		db.update(teams).set({ purgedAt: 5 }).where(eq(teams.id, teamId)).run();
		expect(limitsTotal(db)).toBe(2 * 1024 * MB);
	});

	it('setTeamLimit refuses a bad number and clears with null; setGroupLimit sets the person', () => {
		const teamId = team();
		expect(setTeamLimit(db, teamId, 0)).toBe(false);
		expect(setTeamLimit(db, 999, GB)).toBe(false);
		setTeamLimit(db, teamId, GB);
		expect(teamLimitBytes(db, teamId)).toBe(GB);
		expect(setTeamLimit(db, teamId, null)).toBe(true);
		expect(teamLimitBytes(db, teamId)).toBe(600 * MB);
		expect(setGroupLimit(db, 'u1', 5)).toBe(true);
		expect(setGroupLimit(db, 'u1', -1)).toBe(false);
		expect(setGroupLimit(db, 'u1', null)).toBe(true);
		expect(setGroupLimit(db, 'nobody', 1)).toBe(false);
	});

	it("a person's request and their group's never block each other; granting sets the group's limit", () => {
		const teamId = team();
		expect(askForMore(db, { userId: 'u1' }, null, 10)).toBe('asked');
		expect(askForMore(db, { userId: 'u1', teamId }, 'class', 11)).toBe('asked');
		expect(askForMore(db, { userId: 'u1', teamId }, null, 12)).toBe('already-open');
		expect(openRequest(db, 'u1', teamId)).toEqual({ createdAt: 11, note: 'class' });
		expect(openRequest(db, 'u1')).toEqual({ createdAt: 10, note: null });
		recording(T1_SALSA, 'Team', 5 * MB);
		const reqs = listOpenRequests(db, 'salsa');
		const g = reqs.find((r) => r.teamId === teamId)!;
		expect(g).toMatchObject({
			teamName: 'Salsa nadaljevalna',
			usedBytes: 5 * MB,
			limitBytes: 600 * MB
		});
		expect(reqs.find((r) => r.teamId === null)).toMatchObject({ limitBytes: 1024 * MB });
		expect(resolveRequest(db, g.id, 'granted', 2 * GB, 20)).toBe(true);
		const row = db.select().from(teams).where(eq(teams.id, teamId)).get()!;
		expect(row.storageLimitBytes).toBe(2 * GB);
		expect(storageOf(db, 'u1').limitBytes).toBe(1024 * MB);
		expect(openRequest(db, 'u1', teamId)).toBeNull();
		expect(openRequest(db, 'u1')).not.toBeNull();
	});

	it("listTeamsForAdmin has names and numbers only, with the owner's name", () => {
		const teamId = team();
		db.update(users).set({ firstName: 'Ana', lastName: 'Kranjc' }).where(eq(users.id, 'u1')).run();
		const lesson = createLesson(db, T1_SALSA, {
			title: 'Secret lesson title',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(
			db,
			{ lessonId: lesson.id, file: 'tv.mp4', mime: 'video/mp4', sizeBytes: 20 * MB },
			'u1'
		);
		const rows = listTeamsForAdmin(db, 'salsa');
		expect(rows).toEqual([
			{
				id: teamId,
				name: 'Salsa nadaljevalna',
				dance: 'salsa',
				owner: 'Ana Kranjc',
				people: 3,
				usedBytes: 20 * MB,
				limitBytes: 600 * MB,
				overridden: false,
				deleted: false
			}
		]);
		expect(JSON.stringify(rows)).not.toContain('Secret');
	});

	it("listTeamStorageItems: videos with their lesson's title, recordings, trash marked", () => {
		const teamId = team();
		const lesson = createLesson(db, T1_SALSA, {
			title: 'Turns',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(
			db,
			{ lessonId: lesson.id, file: 'tv.mp4', mime: 'video/mp4', sizeBytes: 20 * MB },
			'u1'
		);
		recording(T1_SALSA, 'Enchufla', 5 * MB);
		recording(U1_SALSA, 'Mine', 99 * MB);
		db.insert(teamTrash)
			.values({
				teamId,
				kind: 'video',
				label: 'Old lesson',
				rootKind: 'lesson',
				rootId: lesson.id,
				rowsJson: '[]',
				sizeBytes: 40 * MB,
				deletedBy: 'u1',
				deletedAt: 1
			})
			.run();
		const items = listTeamStorageItems(db, teamId);
		expect(items.map((i) => [i.kind, i.sizeBytes])).toEqual([
			['trash', 40 * MB],
			['lessonVideo', 20 * MB],
			['recording', 5 * MB]
		]);
		expect(items[0].context).toBe('Old lesson · in Recently deleted');
		expect(items[1].context).toBe('Lesson · Turns');
	});

	it('ownerOfRow throws on a row with neither owner', () => {
		expect(() => ownerOfRow({ userId: null, teamId: null })).toThrow('row has no owner');
		expect(ownerOfRow({ userId: null, teamId: 3 })).toEqual({ teamId: 3 });
		expect(ownerOfRow({ userId: 'u1', teamId: null })).toEqual({ userId: 'u1' });
	});
});

describe('admin: one dance at a time (the dance split)', () => {
	beforeEach(() => {
		db = openDb(':memory:');
		user('a', GB);
		user('b', GB);
		db.update(users).set({ dance: 'bachata' }).where(eq(users.id, 'b')).run();
	});

	// Catches: an admin's lists or changes reaching the other dance's accounts.
	it('lists and reaches only its own dance', () => {
		askForMore(db, { userId: 'b' }, null, 5);
		const req = db.select().from(storageRequests).get()!.id;
		expect(listPeople(db, 'salsa').map((p) => p.id)).toEqual(['a']);
		expect(listOpenRequests(db, 'salsa')).toEqual([]);
		expect(listOpenRequests(db, 'bachata').map((r) => r.userId)).toEqual(['b']);
		expect(adminReaches(db, 'salsa', { userId: 'a' })).toBe(true);
		expect(adminReaches(db, 'salsa', { userId: 'b' })).toBe(false);
		expect(adminReaches(db, 'salsa', { requestId: req })).toBe(false);
		expect(adminReaches(db, 'bachata', { requestId: req })).toBe(true);
		expect(adminReaches(db, 'salsa', { teamId: 999 })).toBe(false);
	});
});

describe('room refusals in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words each refusal with a decimal comma', () => {
		recording(U1_SALSA, 'A', 900 * MB);
		expect(sl(() => roomFor(db, 'u1', 200 * MB))).toMatchObject({
			message:
				'Ni dovolj prostora: porabite 900 MB od 1,0 GB. Sprostite nekaj prostora ali v Nastavitvah prosite za več.'
		});
		const r = sl(() => roomForOwner(db, { userId: 'u2' }, 200 * MB, 2.1 * GB));
		expect(r.ok === false && r.message).toBe(
			'Na strežniku ni dovolj prostora. Obrnite se na skrbnika.'
		);
	});
});
