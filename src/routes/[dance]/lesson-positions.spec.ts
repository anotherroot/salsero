/**
 * A lesson's positions through the lesson page: linking and unlinking by hand,
 * the via rows, what a group's reader sees, and the picker keeping every
 * linked row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import type { Cookies } from '@sveltejs/kit';
import { openDb, type Db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { teamChanges, users } from '$lib/server/db/schema';
import { addLesson } from '$lib/server/entries';
import { createTeam, joinTeam } from '$lib/server/teams';
import { addLessonVideo, createLesson, publishLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkSpotToPosition } from '$lib/server/position-links';
import { addPosition } from '$lib/server/test-positions';
import { archivePosition } from '$lib/server/positions';
import type { Space } from '$lib/server/scope';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import * as lessonPage from './lessons/[id]/+page.server';

const T = Date.UTC(2026, 10, 3, 20);
let db: Db;

const ev = (uid: string, id: number, fields: Record<string, string> = {}) =>
	({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
		cookies: { get: () => undefined, set: () => {}, delete: () => {} } as unknown as Cookies,
		url: new URL(`http://localhost/salsa/lessons/${id}`),
		request: new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		})
	}) as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = Record<string, any>;
async function run(fn: unknown, e: unknown): Promise<Answer> {
	try {
		return (await (fn as (e: unknown) => unknown)(e)) as Answer;
	} catch (thrown) {
		return thrown as Answer;
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
});

const lessonFor = (space: Space = U1_SALSA) =>
	createLesson(db, space, { lessonDay: '2026-11-01', title: 'Week 4', notes: null }).lesson.id;

describe('the picker', () => {
	it('keeps a linked group position that the person has their own copy of', async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		joinTeam(db, 'u2', 1, T);
		const theirs = addPosition(db, T1_SALSA, 'Cerrada', { geneId: 'g1' });
		const mine = addPosition(db, { ...U1_SALSA, userId: 'u2' }, 'Cerrada', { geneId: 'g1' });
		const G = lessonFor(T1_SALSA);
		await run(lessonPage.actions.linkPosition, ev('u1', G, { positionId: String(theirs) }));
		publishLesson(db, T1_SALSA, G, T);
		addLesson(db, 'u2', G, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
		const L = lessonFor({ ...U1_SALSA, userId: 'u2' });
		const before = await run(lessonPage.load, ev('u2', L));
		expect(before.linkablePositions.map((p: Answer) => p.id)).toEqual([mine]);
		const added = await run(
			lessonPage.actions.linkPosition,
			ev('u2', L, { positionId: String(theirs) })
		);
		expect(added.ok).toBe(true);
		const after = await run(lessonPage.load, ev('u2', L));
		expect(after.linkablePositions.map((p: Answer) => [p.id, p.linked])).toEqual([
			[mine, false],
			[theirs, true]
		]);
	});
});

describe('a lesson’s positions', () => {
	it('links and unlinks a position on an own lesson', async () => {
		const L = lessonFor();
		const P = addPosition(db, U1_SALSA, 'Cerrada');
		const linked = await run(
			lessonPage.actions.linkPosition,
			ev('u1', L, { positionId: String(P) })
		);
		expect(linked.ok).toBe(true);
		let data = await run(lessonPage.load, ev('u1', L));
		expect(data.positions.map((p: Answer) => p.name)).toEqual(['Cerrada']);
		const gone = await run(
			lessonPage.actions.unlinkPosition,
			ev('u1', L, { positionId: String(P) })
		);
		expect(gone.ok).toBe(true);
		data = await run(lessonPage.load, ev('u1', L));
		expect(data.positions).toEqual([]);
	});

	it('refuses a missing or foreign position', async () => {
		const L = lessonFor();
		const theirs = addPosition(db, { ...U1_SALSA, userId: 'u2' }, 'Theirs');
		for (const positionId of ['', '999', String(theirs)]) {
			const res = await run(lessonPage.actions.linkPosition, ev('u1', L, { positionId }));
			expect(res).toMatchObject({ status: 400 });
		}
	});

	it('shows a point-linked position as a via row, and unlinking with alsoSections takes the link', async () => {
		const L = lessonFor();
		const P = addPosition(db, U1_SALSA, 'Cerrada');
		const v = addLessonVideo(db, { lessonId: L, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 });
		const spot = addSpot(
			db,
			{ lessonVideoId: v.id },
			{ startMs: 72000, endMs: 91000, label: null }
		)!;
		linkSpotToPosition(db, 'u1', spot.id, P);
		const data = await run(lessonPage.load, ev('u1', L));
		expect(data.positions).toHaveLength(1);
		expect(data.positions[0].viaSections).toHaveLength(1);
		expect(data.positions[0].byHand).toBe(false);
		// What blocks the video's delete, said at once on the page.
		expect(data.videoPositions).toEqual({ [v.id]: [{ name: 'Cerrada', archived: false }] });
		await run(
			lessonPage.actions.unlinkPosition,
			ev('u1', L, { positionId: String(P), alsoSections: '1' })
		);
		expect((await run(lessonPage.load, ev('u1', L))).positions).toEqual([]);
	});

	it('offers a linked position to an editor, and to a reader of a published lesson none', async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		joinTeam(db, 'u2', 1, T);
		const L = lessonFor(T1_SALSA);
		const P = addPosition(db, T1_SALSA, 'Cerrada');
		await run(lessonPage.actions.linkPosition, ev('u1', L, { positionId: String(P) }));
		const editor = await run(lessonPage.load, ev('u1', L));
		expect(editor.linkablePositions.map((p: Answer) => [p.name, p.linked])).toEqual([
			['Cerrada', true]
		]);
		// A draft is its editors' alone.
		expect(await run(lessonPage.load, ev('u2', L))).toMatchObject({ status: 404 });
		publishLesson(db, T1_SALSA, L, T);
		const reader = await run(lessonPage.load, ev('u2', L));
		expect(reader.positions.map((p: Answer) => p.name)).toEqual(['Cerrada']);
		expect(reader.linkablePositions).toEqual([]);
		// What blocks a video's delete is an editor's: a reader gets no position names.
		expect(reader.videoPositions).toEqual({});
	});

	it('refuses the person’s own position on a group lesson', async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		const L = lessonFor(T1_SALSA);
		const own = addPosition(db, U1_SALSA, 'Mine');
		const res = await run(
			lessonPage.actions.linkPosition,
			ev('u1', L, { positionId: String(own) })
		);
		expect(res).toMatchObject({ status: 400 });
	});

	it('writes a History line for a group link and unlink', async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		const L = lessonFor(T1_SALSA);
		const P = addPosition(db, T1_SALSA, 'Cerrada');
		await run(lessonPage.actions.linkPosition, ev('u1', L, { positionId: String(P) }));
		await run(lessonPage.actions.unlinkPosition, ev('u1', L, { positionId: String(P) }));
		const lines = db
			.select()
			.from(teamChanges)
			.where(and(eq(teamChanges.rootKind, 'lesson'), eq(teamChanges.rootId, L)))
			.all()
			.filter((c) => c.subject === 'position');
		expect(lines.map((c) => [c.verb, c.subjectId, c.actorId])).toEqual([
			['add', P, 'u1'],
			['remove', P, 'u1']
		]);
	});
});

describe('a group position archived since the picker opened', () => {
	it('is refused "Archived by …" with Restore; a person’s own archived one keeps its 400', async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		const P = addPosition(db, T1_SALSA, 'Hammerlock');
		archivePosition(db, P, T, { actorId: 'u1' });
		const G = lessonFor(T1_SALSA);
		const res = await run(lessonPage.actions.linkPosition, ev('u1', G, { positionId: String(P) }));
		expect(res).toMatchObject({
			status: 410,
			data: {
				action: 'linkPosition',
				message: 'Archived by u1',
				archived: { by: 'u1', restorable: true, target: { positionId: P } }
			}
		});

		const L = lessonFor();
		const own = addPosition(db, U1_SALSA, 'Own');
		archivePosition(db, own, T);
		expect(
			await run(lessonPage.actions.linkPosition, ev('u1', L, { positionId: String(own) }))
		).toMatchObject({ status: 400 });
	});
});
