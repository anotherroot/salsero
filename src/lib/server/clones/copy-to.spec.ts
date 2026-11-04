/**
 * Copy to… (board C4): a figure, routine, drill, song or lesson copied into
 * your own app or into a group of the dance you own or edit, group to group
 * too. Ana (u1) owns Salsa Tuesdays (T1) and edits Rueda club (T2, Maja's);
 * Luka (u2) is a member of T1. Files are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	figures,
	lessonFigures,
	lessons,
	recordings,
	songs,
	teamChanges,
	users
} from '../db/schema';
import { createSongFromUpload, storeAnalysis } from '../songs';
import { createTeam, deleteTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { addRecording, archiveVariation, createFigure } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { usedBytesOf } from '../storage';
import { markTwins } from '../twins';
import { addLesson } from '../entries';
import { crossRefs } from '../integrity';
import type { Space, TeamSpace } from '../scope';
import { NO_FILES, T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import { geneOf, memberIn } from './genes';
import { copyPlan, copyTargets, copyTo, restoreMember, validUse } from './copy-to';

const OCT_3 = Date.UTC(2026, 9, 3, 10);
const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const MB = 1024 ** 2;
const TZ = 'Europe/Ljubljana';
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

let db: Db;

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
});

const figure = (space: Space, move: string, name = 'Básico', notes: string | null = null) =>
	createFigure(db, space, { figureName: move, name, ...shape, notes })!.figure.id;
const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const recsOf = (figureId: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, figureId)).all();
const teamFigures = (teamId: number) =>
	db.select().from(figures).where(eq(figures.teamId, teamId)).all();
const addsIn = (teamId: number) =>
	db
		.select()
		.from(teamChanges)
		.where(and(eq(teamChanges.teamId, teamId), eq(teamChanges.verb, 'add')))
		.all();

describe('where a thing can go (copyTargets)', () => {
	it('your app and every live group of the dance you own or edit, never its own place', () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble');
		const targets = copyTargets(db, 'u1', 'figure', F);
		expect(targets.map((t) => [t.place, t.role, t.existing])).toEqual([
			[{ kind: 'mine' }, null, null],
			[{ kind: 'team', teamId: 2, name: 'Rueda club' }, 'editor', null]
		]);
		expect(targets[1].limitBytes).toBeGreaterThan(0);

		// Your own: no "Your app"; both groups.
		const mine = figure(U1_SALSA, 'Setenta');
		expect(copyTargets(db, 'u1', 'figure', mine).map((t) => t.place.kind)).toEqual([
			'team',
			'team'
		]);
	});

	it('a member reads: only their own app; a deleted group, another dance and an archived row: none', () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble');
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
			.lesson.id;
		linkFigure(db, L, F, 'u1');
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		expect(copyTargets(db, 'u2', 'figure', F).map((t) => t.place)).toEqual([{ kind: 'mine' }]);

		createTeam(db, 'u1', 'bachata', 'Bachata Fridays', T);
		const mine = figure(U1_SALSA, 'Setenta');
		expect(deleteTeam(db, 2, 'u3', NOW)).toBe(true);
		expect(copyTargets(db, 'u1', 'figure', mine).map((t) => t.place)).toEqual([
			{ kind: 'team', teamId: 1, name: 'Salsa Tuesdays' }
		]);

		archiveVariation(db, mine, NOW);
		expect(copyTargets(db, 'u1', 'figure', mine)).toEqual([]);
		// Someone else's own row: nothing, not even a hint.
		expect(copyTargets(db, 'u2', 'figure', figure(U1_SALSA, 'Dile que no'))).toEqual([]);
	});
});

describe('group to group', () => {
	it('copies T1’s figure into T2 with its recordings, charged to T2, with one add', async () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble', 'Arms high');
		addRecording(
			db,
			{
				figureId: F,
				file: 'r.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 5 * MB,
				note: null
			},
			'u1'
		);
		const plan = copyPlan(db, 'u1', 'figure', F, T2_SALSA, TZ);
		expect(plan).toMatchObject({
			goes: '1 recording (5 MB, charged to the group) · notes',
			bytes: 5 * MB,
			already: [],
			twins: []
		});
		const before = addsIn(2).length;
		const usedBefore = usedBytesOf(db, { teamId: 2 });

		const res = await copyTo(db, 'u1', 'figure', F, T2_SALSA, {}, NO_FILES, NOW, ROOMY);
		expect(res).toMatchObject({ ok: true, made: true });
		if (!res.ok) return;
		expect(row(res.id)).toMatchObject({
			teamId: 2,
			userId: null,
			notes: 'Arms high',
			geneId: geneOf(db, 'figure', F),
			clonedFrom: F
		});
		expect(recsOf(res.id).map((r) => r.file)).toEqual(['copy-r.mp4']);
		expect(usedBytesOf(db, { teamId: 2 }) - usedBefore).toBe(5 * MB);
		const added = addsIn(2).slice(before);
		expect(added).toHaveLength(1);
		expect(added[0]).toMatchObject({ actorId: 'u1', rootKind: 'figure', subjectId: res.id });
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a place the actor does not edit, and a group of the other side', async () => {
		const F = figure(T1_SALSA, 'Enchufla');
		const member: TeamSpace = { teamId: 1, actorId: 'u2', dance: 'salsa' };
		const G = figure(T2_SALSA, 'Setenta');
		expect(await copyTo(db, 'u2', 'figure', G, member, {}, NO_FILES, NOW, ROOMY)).toEqual({
			ok: false,
			reason: 'denied'
		});
		// Into its own place: not a target.
		expect(await copyTo(db, 'u1', 'figure', F, T1_SALSA, {}, NO_FILES, NOW, ROOMY)).toEqual({
			ok: false,
			reason: 'denied'
		});
		// The space names someone else as actor.
		expect(
			await copyTo(db, 'u2', 'figure', F, { ...T2_SALSA, actorId: 'u2' }, {}, NO_FILES, NOW, ROOMY)
		).toEqual({ ok: false, reason: 'denied' });
	});
});

describe('a lesson into a group', () => {
	it('lands as a draft, and a figure the group already has a copy of is reused', async () => {
		const D = figure(U1_SALSA, 'Enchufla', 'Doble');
		const E = figure(U1_SALSA, 'Setenta');
		// Ana copied her Doble into T1 on 3 Oct.
		const early = await cloneInto(
			db,
			{ kind: 'figure', id: D, into: T1_SALSA, recordings: true },
			NO_FILES,
			OCT_3
		);
		if (!early.ok) throw new Error('early copy refused');
		const L = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'Week 3',
			notes: 'Warm up first'
		}).lesson.id;
		linkFigure(db, L, D);
		linkFigure(db, L, E);

		const plan = copyPlan(db, 'u1', 'lesson', L, T1_SALSA, TZ);
		expect(plan.already).toEqual([
			'Enchufla · Doble: Salsa Tuesdays has your copy from 3 Oct. It’s reused, not doubled.'
		]);
		expect(plan.goes).toBe('1 figure · notes');
		const t1Before = teamFigures(1).length;

		const res = await copyTo(db, 'u1', 'lesson', L, T1_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('copy refused');
		const copy = db.select().from(lessons).where(eq(lessons.id, res.id)).get()!;
		expect(copy).toMatchObject({ teamId: 1, publishedAt: null, title: 'Week 3' });
		const linked = db
			.select({ f: lessonFigures.figureId })
			.from(lessonFigures)
			.where(eq(lessonFigures.lessonId, res.id))
			.all()
			.map((r) => r.f);
		expect(linked).toContain(early.id);
		expect(teamFigures(1)).toHaveLength(t1Before + 1); // Setenta only
		expect(crossRefs(db)).toEqual([]);
	});

	it('says "has it already" for a group figure nobody copied in', () => {
		const G = figure(T1_SALSA, 'Enchufla', 'Doble');
		const W1 = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
			.lesson.id;
		linkFigure(db, W1, G, 'u1');
		expect(publishLesson(db, T1_SALSA, W1, T)).toBe(true);
		expect(addLesson(db, 'u1', W1, NONE, T)).toBe(true);
		const L = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Week 3', notes: null })
			.lesson.id;
		expect(linkFigure(db, L, G)).toBe(true);
		expect(copyPlan(db, 'u1', 'lesson', L, T1_SALSA, TZ).already).toEqual([
			expect.stringMatching(/^Enchufla · Doble: Salsa Tuesdays has it already, from \d+ \w+\./)
		]);
	});
});

describe('twins: only one version goes (spec point 5)', () => {
	function twinned() {
		const mine = figure(U1_SALSA, 'Enchufla', 'Doble');
		const theirs = figure(T2_SALSA, 'Enchufla', 'Doble');
		expect(markTwins(db, U1_SALSA, 'figure', [mine, theirs])).toBe(true);
		return { mine, theirs };
	}

	it('asks which, and the group gets a member of the chosen one’s family', async () => {
		const { mine, theirs } = twinned();
		const plan = copyPlan(db, 'u1', 'figure', mine, T1_SALSA, TZ);
		expect(plan.twins).toHaveLength(1);
		const [ask] = plan.twins;
		expect(ask.label).toBe('Enchufla · Doble');
		expect(ask.from).toBe(mine);
		expect(ask.choices.map((c) => [c.id, c.place.kind])).toEqual([
			[mine, 'mine'],
			[theirs, 'team']
		]);
		expect(ask.choices[0].meta).toMatch(/^Last changed \d+ \w+$/);

		const res = await copyTo(
			db,
			'u1',
			'figure',
			mine,
			T1_SALSA,
			{ [ask.gene]: theirs },
			NO_FILES,
			NOW,
			ROOMY
		);
		if (!res.ok || !res.made) throw new Error('copy refused');
		const theirGene = geneOf(db, 'figure', theirs)!;
		expect(row(res.id)).toMatchObject({ teamId: 1, geneId: theirGene, clonedFrom: theirs });
		// Yours never went: no member of your family in T1.
		const mineGene = geneOf(db, 'figure', mine);
		expect(mineGene === null || memberIn(db, 'figure', mineGene, T1_SALSA) === null).toBe(true);
	});

	it('asks nothing into your app, and refuses a choice it did not offer', async () => {
		const { mine } = twinned();
		const other = figure(T2_SALSA, 'Setenta');
		expect(copyPlan(db, 'u1', 'figure', mine, U1_SALSA, TZ).twins).toEqual([]);
		const [ask] = copyPlan(db, 'u1', 'figure', mine, T1_SALSA, TZ).twins;
		expect(
			await copyTo(db, 'u1', 'figure', mine, T1_SALSA, { [ask.gene]: other }, NO_FILES, NOW, ROOMY)
		).toEqual({ ok: false, reason: 'denied' });
		expect(teamFigures(1)).toEqual([]);
	});
});

describe('a place that already holds a member (spec point 9)', () => {
	it('answers the member there, live or archived; Restore brings an archived one back', async () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble');
		const first = await copyTo(db, 'u1', 'figure', F, T2_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!first.ok) throw new Error('copy refused');
		const again = await copyTo(db, 'u1', 'figure', F, T2_SALSA, {}, NO_FILES, NOW + 1, ROOMY);
		expect(again).toEqual({ ok: true, made: false, id: first.id, archived: false });
		expect(copyTargets(db, 'u1', 'figure', F)[1].existing).toEqual({
			id: first.id,
			archived: false,
			at: NOW
		});

		archiveVariation(db, first.id, NOW + 2, 'u1');
		expect(await copyTo(db, 'u1', 'figure', F, T2_SALSA, {}, NO_FILES, NOW + 3, ROOMY)).toEqual({
			ok: true,
			made: false,
			id: first.id,
			archived: true
		});
		expect(restoreMember(db, 'u1', 'figure', F, T2_SALSA, first.id + 99, NOW + 4)).toBeNull();
		expect(restoreMember(db, 'u1', 'figure', F, T2_SALSA, first.id, NOW + 4)).toEqual({ ok: true });
		expect(row(first.id).archivedAt).toBeNull();
		expect(teamFigures(2)).toHaveLength(1);
	});
});

describe('into your own app', () => {
	it('a reader’s copy is Make it mine: their routines and practice follow it', async () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble');
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
			.lesson.id;
		linkFigure(db, L, F, 'u1');
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		const res = await copyTo(db, 'u2', 'figure', F, U2_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('copy refused');
		expect(row(res.id)).toMatchObject({ userId: 'u2', teamId: null, clonedFrom: F });
		expect(copyTargets(db, 'u2', 'figure', F)[0].existing?.id).toBe(res.id);
	});

	it('an editor’s copy brings no recordings (ruling 5)', async () => {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble');
		addRecording(
			db,
			{ figureId: F, file: 'r.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: MB, note: null },
			'u1'
		);
		expect(copyPlan(db, 'u1', 'figure', F, U1_SALSA, TZ).goes).toBe('Just the figure');
		const res = await copyTo(db, 'u1', 'figure', F, U1_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('copy refused');
		expect(row(res.id)).toMatchObject({ userId: 'u1', teamId: null });
		expect(recsOf(res.id)).toEqual([]);
	});
});

describe('another place’s answers (review fixes)', () => {
	function twinned() {
		const mine = figure(U1_SALSA, 'Enchufla', 'Doble');
		const theirs = figure(T2_SALSA, 'Enchufla', 'Doble');
		expect(markTwins(db, U1_SALSA, 'figure', [mine, theirs])).toBe(true);
		const [ask] = copyPlan(db, 'u1', 'figure', mine, T1_SALSA, TZ).twins;
		return { mine, theirs, gene: ask.gene };
	}

	it('a stale `use` into a place holding a member answers that member, not denied', async () => {
		const { mine, theirs, gene } = twinned();
		const first = await copyTo(db, 'u1', 'figure', mine, T1_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!first.ok) throw new Error('copy refused');
		// T1 now holds Yours: nothing is asked any more, and the old answer is ignored.
		expect(copyPlan(db, 'u1', 'figure', mine, T1_SALSA, TZ).twins).toEqual([]);
		expect(
			await copyTo(db, 'u1', 'figure', mine, T1_SALSA, { [gene]: theirs }, NO_FILES, NOW, ROOMY)
		).toEqual({ ok: true, made: false, id: first.id, archived: false });
	});

	it('validUse keeps only answers to questions asked, with choices offered', () => {
		const { mine, theirs, gene } = twinned();
		const other = figure(T2_SALSA, 'Setenta');
		expect(validUse(db, 'u1', 'figure', mine, T1_SALSA, { [gene]: theirs })).toEqual({
			[gene]: theirs
		});
		expect(validUse(db, 'u1', 'figure', mine, T1_SALSA, { [gene]: other })).toBeNull();
		expect(validUse(db, 'u1', 'figure', mine, T1_SALSA, { [`figure#${other}`]: other })).toBeNull();
		// Into your own app nothing is asked: answers are dropped.
		const own = figure(T1_SALSA, 'Dile que no');
		expect(validUse(db, 'u1', 'figure', own, U1_SALSA, { x: 1 })).toEqual({});
	});

	it('Restore applies to the chosen twin’s archived member there', async () => {
		const { mine, theirs, gene } = twinned();
		const use = { [gene]: theirs };
		const made = await copyTo(db, 'u1', 'figure', mine, T1_SALSA, use, NO_FILES, NOW, ROOMY);
		if (!made.ok || !made.made) throw new Error('copy refused');
		archiveVariation(db, made.id, NOW + 1, 'u1');
		expect(await copyTo(db, 'u1', 'figure', mine, T1_SALSA, use, NO_FILES, NOW + 2, ROOMY)).toEqual(
			{ ok: true, made: false, id: made.id, archived: true }
		);
		// Without the answer it is no member of this row's family: nothing to restore.
		expect(restoreMember(db, 'u1', 'figure', mine, T1_SALSA, made.id, NOW + 3)).toBeNull();
		expect(restoreMember(db, 'u1', 'figure', mine, T1_SALSA, made.id, NOW + 3, use)).toEqual({
			ok: true
		});
		expect(row(made.id).archivedAt).toBeNull();
	});

	it('a song copied into a group lands as a draft', async () => {
		const S = createSongFromUpload(db, U1_SALSA, {
			file: '00000000-0000-4000-8000-0000000000c1.mp3',
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'salsa',
			sizeBytes: 1000
		}).id;
		storeAnalysis(db, S, { beats: [0.5, 1, 1.5, 2], downbeats: [0.5], durationS: 90 });
		const res = await copyTo(db, 'u1', 'song', S, T1_SALSA, {}, NO_FILES, NOW, ROOMY);
		if (!res.ok || !res.made) throw new Error('copy refused');
		expect(db.select().from(songs).where(eq(songs.id, res.id)).get()).toMatchObject({
			teamId: 1,
			sharedAt: null,
			status: 'ready'
		});
	});
});
