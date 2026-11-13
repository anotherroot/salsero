/**
 * Copy and link: a row from another place copied into a group and linked to
 * its lesson or video, in one transaction. Ana (u1) owns Salsa Tuesdays (T1)
 * and edits Rueda club (T2, Maja's); Luka (u2) is a member of T1.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	figures,
	lessonFigures,
	spotLinks,
	spotPositionLinks,
	teamChanges,
	users
} from './db/schema';
import { createTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { archiveVariation, createFigure } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createPosition } from './positions';
import { addSpot } from './spots';
import { markTwins } from './twins';
import { cloneInto } from './clones/clone';
import { copyPlan } from './clones/copy-to';
import { geneOf } from './clones/genes';
import type { Space, TeamSpace } from './scope';
import type { PositionRow } from './db/schema';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_SALSA } from './test-walls';
import {
	copyAndLink,
	useOnly,
	copyLinkRequest,
	lessonLinker,
	restoreAndLink,
	spotLinker
} from './link-elsewhere';

const T = Date.UTC(2026, 10, 3, 20);
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const T1_LUKA: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };

let db: Db;
let lesson: number;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u3', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u1', 2, T);
	setRole(db, 2, 'u1', 'editor', T);
	joinTeam(db, 'u2', 1, T);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'W1', notes: null }).lesson
		.id;
});

const figure = (space: Space, move: string, name = 'Basic') =>
	createFigure(db, space, { figureName: move, name, ...shape })!.figure.id;
const teamFigures = () => db.select().from(figures).where(eq(figures.teamId, 1)).all();
const linked = () =>
	db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lesson))
		.all()
		.map((r) => r.id);
const copy = async (id: number, into: Space) => {
	const r = await cloneInto(db, { kind: 'figure', id, into, recordings: true }, NO_FILES, T, ROOMY);
	if (!r.ok) throw new Error('copy failed');
	return r.id;
};
const run = (id: number, link = lessonLinker('figure', lesson, 'u1'), use = {}) =>
	copyAndLink(db, 'u1', 'figure', id, T1_SALSA, use, link, NO_FILES, T, ROOMY);

describe('copyAndLink', () => {
	it('copies into the group and links, one family', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const res = await run(F);
		expect(res).toMatchObject({ ok: true, made: true });
		const id = (res as { id: number }).id;
		expect(linked()).toEqual([id]);
		expect(geneOf(db, 'figure', id)).toBe(geneOf(db, 'figure', F));
	});

	it('History has the copy and the link, by who acted', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const lines = () => db.select().from(teamChanges).where(eq(teamChanges.teamId, 1)).all();
		const before = new Set(lines().map((l) => l.id));
		expect(await run(F)).toMatchObject({ ok: true, made: true });
		const added = lines().filter((l) => !before.has(l.id));
		expect(added.map((l) => [l.rootKind, l.verb, l.actorId]).sort()).toEqual([
			['figure', 'add', 'u1'],
			['lesson', 'add', 'u1']
		]);
	});

	it('Copy and use (a field picker): copied as a clone, nothing linked; again, the member', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const res = await run(F, useOnly);
		expect(res).toMatchObject({ ok: true, made: true });
		const id = (res as { id: number }).id;
		expect(linked()).toEqual([]);
		expect(geneOf(db, 'figure', id)).toBe(geneOf(db, 'figure', F));
		expect(await run(F, useOnly)).toEqual({ ok: true, id, made: false });
	});

	it('a refused link leaves no copy', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const before = teamFigures().length;
		const res = await run(F, () => false);
		expect(res).toMatchObject({ ok: false, reason: 'refused' });
		expect(teamFigures().length).toBe(before);
	});

	it('a live member is linked, not copied', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const member = await copy(F, T1_SALSA);
		const before = teamFigures().length;
		expect(await run(F)).toEqual({ ok: true, id: member, made: false });
		expect(linked()).toEqual([member]);
		expect(teamFigures().length).toBe(before);
	});

	it('a twin chosen whose family lives in the group is linked, not copied', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const G = figure(T2_SALSA, 'Cradle entry', 'Theirs');
		expect(markTwins(db, U1_SALSA, 'figure', [F, G])).toBe(true);
		const member = await copy(G, T1_SALSA);
		const q = copyPlan(db, 'u1', 'figure', F, T1_SALSA).twins;
		expect(q.length).toBe(1);
		const res = await run(F, undefined, { [q[0].gene]: G });
		expect(res).toEqual({ ok: true, id: member, made: false });
		expect(linked()).toEqual([member]);
	});

	it('an archived member answers restore; restoreAndLink restores and links', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const member = await copy(F, T1_SALSA);
		archiveVariation(db, member, T + 1, 'u1');
		expect(await run(F)).toEqual({ ok: false, restore: member });
		expect(linked()).toEqual([]);
		const done = restoreAndLink(
			db,
			'u1',
			'figure',
			F,
			T1_SALSA,
			member,
			{},
			lessonLinker('figure', lesson, 'u1'),
			T + 2
		);
		expect(done).toEqual({ ok: true, id: member, made: false });
		expect(linked()).toEqual([member]);
	});

	it('a reader of the group is denied', async () => {
		const F = figure(U1_SALSA, 'Cradle entry');
		const res = await copyAndLink(
			db,
			'u2',
			'figure',
			F,
			T1_LUKA,
			{},
			lessonLinker('figure', lesson, 'u2'),
			NO_FILES,
			T,
			ROOMY
		);
		expect(res).toMatchObject({ ok: false, reason: 'denied' });
	});
});

describe('spotLinker', () => {
	it("links a section of a group's lesson video, and a point to a position", async () => {
		const v = addLessonVideo(
			db,
			{ lessonId: lesson, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const section = addSpot(
			db,
			{ lessonVideoId: v },
			{ startMs: 0, endMs: 1000, label: null },
			'u1'
		)!.id;
		const point = addSpot(
			db,
			{ lessonVideoId: v },
			{ startMs: 0, endMs: null, label: null },
			'u1'
		)!.id;
		const F = figure(U1_SALSA, 'Cradle entry');
		const res = await run(F, spotLinker('figure', T1_SALSA, section));
		expect(res).toMatchObject({ ok: true, made: true });
		const id = (res as { id: number }).id;
		expect(
			db
				.select()
				.from(spotLinks)
				.where(and(eq(spotLinks.spotId, section), eq(spotLinks.figureId, id)))
				.all()
		).toHaveLength(1);

		const P = (
			createPosition(
				db,
				U1_SALSA,
				{
					name: 'Cradle hold',
					styleTag: 'salsa',
					hold: { hands: 'two', crossed: null, facing: 'face', frame: 'closed' },
					notes: null,
					pictureSpotId: null
				},
				T
			) as PositionRow
		).id;
		const pos = await copyAndLink(
			db,
			'u1',
			'position',
			P,
			T1_SALSA,
			{},
			spotLinker('position', T1_SALSA, point),
			NO_FILES,
			T,
			ROOMY
		);
		expect(pos).toMatchObject({ ok: true, made: true });
		expect(
			db.select().from(spotPositionLinks).where(eq(spotPositionLinks.spotId, point)).all()
		).toHaveLength(1);
		// A figure on a point is refused, and nothing is copied.
		const before = teamFigures().length;
		const refused = await run(figure(U1_SALSA, 'Setenta'), spotLinker('figure', T1_SALSA, point));
		expect(refused).toMatchObject({ ok: false, reason: 'refused' });
		expect(teamFigures().length).toBe(before);
	});
});

describe('copyLinkRequest', () => {
	it('reads a form’s or a body’s kind, id, use and restore', () => {
		expect(copyLinkRequest({ kind: 'figure', id: '12', use: '{"g":3}', restore: '' })).toEqual({
			kind: 'figure',
			id: 12,
			use: { g: 3 },
			restore: null
		});
		expect(copyLinkRequest({ kind: 'drill', id: 4, use: { g: 3 }, restore: 9 })).toEqual({
			kind: 'drill',
			id: 4,
			use: { g: 3 },
			restore: 9
		});
		expect(copyLinkRequest({ kind: 'position', id: 4 })).toMatchObject({ use: {}, restore: null });
	});

	it('refuses anything else', () => {
		expect(copyLinkRequest({ kind: 'song', id: 1 })).toBeNull();
		expect(copyLinkRequest({ kind: 'figure', id: '-1' })).toBeNull();
		expect(copyLinkRequest({ kind: 'figure', id: 1, use: '{"g":-1}' })).toBeNull();
		expect(copyLinkRequest({ kind: 'figure', id: 1, restore: 'x' })).toBeNull();
		expect(copyLinkRequest(null)).toBeNull();
	});
});
