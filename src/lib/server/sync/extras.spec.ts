import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const fakes = vi.hoisted(() => ({ pending: 0, grants: 0, release: null as unknown }));
vi.mock('$lib/server/ai-queue/store', () => ({ pendingCount: () => fakes.pending }));
vi.mock('$lib/server/oauth/store', () => ({
	listGrants: () => Array.from({ length: fakes.grants }, (_, i) => ({ id: i }))
}));
vi.mock('$lib/server/releases', () => ({ currentRelease: () => fakes.release }));

import { openDb, type Db } from '$lib/server/db';
import { makeClass, CLASS_ED } from '$lib/server/test-class';
import { createImport, storeImportItems } from '$lib/server/song-imports';
import { deviceSlots, lessonVideos, teamTrash } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { usedBytesOf } from '$lib/server/storage';
import { lastEdit } from '$lib/server/changes';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { serverExtras } from './extras';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	makeClass(db);
	db.run(sql`UPDATE users SET dance = 'salsa'`);
	Object.assign(fakes, { pending: 0, grants: 0, release: null });
});

function readyImport(space: Parameters<typeof createImport>[1], url: string): number {
	const imp = createImport(db, space, { url, kind: 'youtube-playlist' });
	storeImportItems(db, imp.id, {
		name: 'List',
		items: [{ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', title: 'One' }],
		truncated: false
	});
	return imp.id;
}

describe('serverExtras', () => {
	it('is empty for a person with nothing waiting', () => {
		expect(serverExtras(db, 'u4')).toEqual({
			musicToPick: false,
			aiPending: 0,
			aiConnected: false,
			release: null,
			imports: { own: [], teams: {} },
			teamTrashBytes: {},
			lastEdits: {},
			devices: {}
		});
	});

	it("carries the Music dot, the AI count and the group's imports", () => {
		readyImport({ dance: 'salsa', userId: 'u2' }, 'https://www.youtube.com/playlist?list=A');
		const team = readyImport(CLASS_ED, 'https://www.youtube.com/playlist?list=B');
		fakes.pending = 2;
		fakes.grants = 1;
		const x = serverExtras(db, 'u2');
		expect(x.musicToPick).toBe(true);
		expect(x.aiPending).toBe(2);
		expect(x.aiConnected).toBe(true);
		// Own view: own lists, then the ready lists of the groups they edit.
		expect(x.imports.own.map((r) => r.id)).toHaveLength(2);
		// Group view: the group's own lists.
		expect(x.imports.teams['1'].map((r) => r.id)).toEqual([team]);
	});

	it('never carries a group the person does not edit', () => {
		readyImport(CLASS_ED, 'https://www.youtube.com/playlist?list=B');
		// Maja is a member, not an editor: no group view, nothing to pick.
		const x = serverExtras(db, 'u3');
		expect(x.imports.teams).toEqual({});
		expect(x.musicToPick).toBe(false);
	});

	it("carries the dance's current release", () => {
		fakes.release = {
			versionCode: 9,
			versionName: '1.8',
			minVersionCode: 1,
			sha256: 'x',
			size: 1,
			commit: 'c'
		};
		expect(serverExtras(db, 'u1').release).toEqual(fakes.release);
	});
});

describe("a group's facts the copy cannot count", () => {
	const g = globalThis as { __salsaDevice?: unknown };
	afterEach(() => delete g.__salsaDevice);

	function trash(teamId: number, sizeBytes: number) {
		db.insert(teamTrash)
			.values({
				teamId,
				kind: 'video',
				label: 'x',
				rootKind: 'lesson',
				rootId: 1,
				rowsJson: '[]',
				sizeBytes,
				deletedBy: 'u1',
				deletedAt: 1
			})
			.run();
	}

	it("carries the group's Recently deleted bytes and lessons' last edits", () => {
		trash(1, 500);
		const x = serverExtras(db, 'u2');
		expect(x.teamTrashBytes).toEqual({ '1': 500 });
		const lesson = Object.keys(x.lastEdits).find((k) => k.startsWith('lesson:'));
		expect(lesson).toBeDefined();
		expect(x.lastEdits[lesson!]).toMatchObject({
			actorId: expect.any(String),
			at: expect.any(Number)
		});
	});

	it("on the device, a group's usage adds the trash the pull counted", () => {
		trash(1, 500);
		const onServer = usedBytesOf(db, { teamId: 1 });
		db.run(sql`DELETE FROM team_trash`);
		g.__salsaDevice = {
			userId: 'u2',
			cookies: {},
			slot: null,
			extras: serverExtrasWith({ teamTrashBytes: { '1': 500 } })
		};
		expect(usedBytesOf(db, { teamId: 1 })).toBe(onServer);
	});

	it("on the device, a lesson's last edit comes from the pull", () => {
		g.__salsaDevice = {
			userId: 'u2',
			cookies: {},
			slot: null,
			extras: serverExtrasWith({ lastEdits: { 'lesson:42': { actorId: 'u1', at: 7 } } })
		};
		expect(lastEdit(db, 1, 'lesson', 42)).toEqual({ actorId: 'u1', at: 7 });
		expect(lastEdit(db, 1, 'lesson', 43)).toBeNull();
	});
});

function serverExtrasWith(over: Partial<ReturnType<typeof serverExtras>>) {
	return { ...serverExtras(db, 'u4'), ...over };
}

describe("lessons' last edits reach only who may read the lesson", () => {
	it("a member gets the published lessons' edits, never a draft's", () => {
		const draft = createLesson(db, CLASS_ED, {
			lessonDay: '2026-11-02',
			title: 'Draft',
			notes: null
		}).lesson.id;
		// Luka edits the group: the draft's last edit reaches him.
		expect(serverExtras(db, 'u2').lastEdits).toHaveProperty(`lesson:${draft}`);
		// Maja is a member: published lessons only.
		const maja = serverExtras(db, 'u3').lastEdits;
		expect(maja).not.toHaveProperty(`lesson:${draft}`);
		expect(Object.keys(maja).length).toBeGreaterThan(0);
	});
});

describe("devices: what holds the person's phone-only originals (offline phase 4c)", () => {
	it('names each slot a phone-only row points at, and no other', () => {
		db.insert(deviceSlots)
			.values([
				{
					slot: 3,
					deviceKey: 'k3',
					userId: 'u4',
					createdAt: 1,
					label: '{"kind":"android","model":"Pixel 8"}'
				},
				{
					slot: 4,
					deviceKey: 'k4',
					userId: 'u4',
					createdAt: 1,
					label: '{"kind":"iphone","model":null}'
				}
			])
			.run();
		const lesson = createLesson(
			db,
			{ userId: 'u4', dance: 'salsa' },
			{
				title: 'L',
				lessonDay: '2026-11-01',
				notes: null
			}
		).lesson;
		const v = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'a.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		db.update(lessonVideos)
			.set({ serverCopy: false, originSlot: 3 })
			.where(eq(lessonVideos.id, v.id))
			.run();
		expect(serverExtras(db, 'u4').devices).toEqual({ '3': { kind: 'android', model: 'Pixel 8' } });
		expect(serverExtras(db, 'u1').devices).toEqual({});
	});
});
