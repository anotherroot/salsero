/**
 * `applyInto`: a member receives another's value of each picked key, in
 * place, key family by key family. The target keeps its id, its entries and
 * its sections' links; a reference is the target place's member of its
 * family; a delete goes through its own function (refused for a linked
 * section, to Recently deleted in a group). Files are fakes; the database is
 * in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessonPositions,
	lessons,
	lessonVideos,
	links,
	figureEndPositions,
	figureStartPositions,
	positions,
	recordings,
	routines,
	songs,
	spotLinks,
	spotPositionLinks,
	teamChanges,
	teamTrash,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import {
	addFigureExercise,
	addRecording,
	createFigure,
	createVariationIn,
	updateVariation
} from '../figures';
import { createCustomExercise } from '../exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkFigure,
	linkPosition,
	publishLesson,
	unlinkFigure,
	unlinkPosition
} from '../lessons';
import { addChildSlot, addFigureSlot, createRoutine, routineSlots } from '../routines';
import { addLesson, entryFor } from '../entries';
import { addLinks, deleteLink } from '../links';
import { addSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { linkPositionInSpace } from '../position-links';
import { crossRefs } from '../integrity';
import { createSongFromUpload } from '../songs';
import { insertFixturePositions } from '../test-positions';
import { figurePositions } from '../graph';
import { ownerValues, type Space } from '../scope';
import { T1_SALSA, U1_SALSA } from '../test-walls';
import type { CloneKind } from '$lib/types';
import { diff } from '$lib/clones/diff';
import { geneOf, memberIn } from './genes';
import { digest, hashValue, pairBase } from './pairs';
import { flatOf } from './trees';
import { cloneInto, fileKey } from './clone';
import type { CloneFiles } from './files';
import { applyInto, syncFrom } from './apply';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const files: CloneFiles = { link: async (_k, file) => `copy-${file}`, unlink: async () => {} };

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	// The group's positions: a group's figure is tagged only with its own (ruling 15).
	insertFixturePositions(db, { teamId: 1 });
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
});

const figure = (space: Space, move: string, name: string) =>
	createFigure(db, space, { figureName: move, name, ...shape })!;
const recording = (figureId: number, file: string) =>
	addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes: 50, note: null },
		'u1'
	).id;

async function copy(kind: CloneKind, id: number, into: Space, recordings = false) {
	const r = await cloneInto(db, { kind, id, into, recordings }, files, T);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

/** Every key where `giver` differs from `target` (`skip` too, with `all`: apply writes no snapshot). */
const differing = (kind: CloneKind, target: number, giver: number, all = false) =>
	diff(
		all ? null : pairBase(db, kind, target, giver),
		flatOf(db, kind, target),
		flatOf(db, kind, giver),
		hashValue
	).map((d) => d.key);

function apply(
	kind: CloneKind,
	target: number,
	giver: number,
	keys: string[],
	linked = new Map<string, string>()
) {
	return db.transaction((tx) =>
		applyInto(tx as unknown as Db, kind, target, giver, keys, linked, 'u1', NOW)
	);
}

/**
 * Salsa Tuesdays' Enchufla · Doble (F), published, with one recording whose
 * section links the group's drill Shines (D); u2 added the lesson and
 * practises F; u1's own copy of F (M), without the recording.
 */
async function world() {
	const made = figure(T1_SALSA, 'Enchufla', 'Doble');
	const F = made.figure.id;
	const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
	const rec = recording(F, 'g.mp4');
	const spot = addSpot(
		db,
		{ recordingId: rec },
		{ startMs: 1000, endMs: 2000, label: 'Turn' },
		'u1'
	)!.id;
	linkInSpace(db, T1_SALSA, spot, { exerciseId: D });
	addLinks(db, { figureId: F }, ['https://example.org/doble'], 'Doble', 'u1');
	const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
		.lesson.id;
	linkFigure(db, lesson, F, 'u1');
	publishLesson(db, T1_SALSA, lesson, T);
	addLesson(db, 'u2', lesson, { lesson: true, figureIds: [F], routineIds: [], drillIds: [] }, T);
	const M = await copy('figure', F, U1_SALSA);
	return { F, D, rec, spot, lesson, move: made.group.id, M };
}

describe('root fields', () => {
	it('a figure’s notes, partner, style, timing and positions land in place', async () => {
		const { F, M, spot } = await world();
		const [open] = db.select().from(positions).where(eq(positions.dance, 'salsa')).all();
		db.update(figures)
			.set({
				notes: 'Turn sooner',
				partner: 'solo',
				styleTag: 'son',
				startCount: 5,
				lengthCounts: 8
			})
			.where(eq(figures.id, M))
			.run();
		// M ends in the group's Open: a group position u1 may use. Sent, it is
		// the group's own row there (the target place's member of its family).
		db.insert(figureEndPositions).values({ figureId: M, positionId: open.id }).run();
		const entry = entryFor(db, 'u2', { figureId: F })!;

		const keys = ['notes', 'partner', 'style', 'timing', `end:#${open.id}`];
		expect(differing('figure', F, M)).toEqual(keys);
		expect(apply('figure', F, M, keys)).toMatchObject({ ok: true, removals: false });

		const row = db.select().from(figures).where(eq(figures.id, F)).get()!;
		expect(row).toMatchObject({
			notes: 'Turn sooner',
			partner: 'solo',
			styleTag: 'son',
			startCount: 5,
			lengthCounts: 8
		});
		expect(figurePositions(db, F)).toEqual({ startIds: [], endIds: [open.id] });
		expect(differing('figure', F, M)).toEqual([]);
		// In place: the entry and the section's link still hold.
		expect(entryFor(db, 'u2', { figureId: F })!.id).toBe(entry.id);
		expect(db.select().from(spotLinks).where(eq(spotLinks.spotId, spot)).all()).toHaveLength(1);
	});

	it('a name lands when free (entries renamed), and is refused, writing nothing, when taken', async () => {
		const { F, M, move } = await world();
		createVariationIn(db, move, { name: 'Básico', ...shape }, 'u1');
		updateVariation(db, M, { name: 'Básico', ...shape, notes: 'n' });

		expect(apply('figure', F, M, ['notes', 'name'])).toEqual({
			ok: false,
			reason: 'name',
			message: 'Básico is taken in Enchufla; rename one first.'
		});
		expect(db.select().from(figures).where(eq(figures.id, F)).get()).toMatchObject({
			name: 'Doble',
			notes: null
		});

		updateVariation(db, M, { name: 'Doble suave', ...shape, notes: 'n' });
		expect(apply('figure', F, M, ['name']).ok).toBe(true);
		expect(db.select().from(figures).where(eq(figures.id, F)).get()!.name).toBe('Doble suave');
		expect(entryFor(db, 'u2', { figureId: F })!.name).toBe('Enchufla · Doble suave');
	});

	it('a drill’s Comes back is a field: Compare lists it and Take writes theirs; Warm-up is not', async () => {
		const D = createCustomExercise(db, U1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const D2 = await copy('drill', D, T1_SALSA);
		expect(differing('drill', D2, D)).toEqual([]);
		const every2 = JSON.stringify({ kind: 'every', days: 2 });
		db.update(exercises)
			.set({ comesBack: every2, warmup: true, warmupOrder: 1 })
			.where(eq(exercises.id, D))
			.run();
		expect(differing('drill', D2, D)).toEqual(['comesBack']);
		expect(apply('drill', D2, D, ['comesBack']).ok).toBe(true);
		expect(db.select().from(exercises).where(eq(exercises.id, D2)).get()).toMatchObject({
			comesBack: every2,
			warmup: false,
			warmupOrder: null
		});
		expect(differing('drill', D2, D)).toEqual([]);
	});

	it('Take of an until setting starts it now, unless the receiver was already on until', async () => {
		const D = createCustomExercise(db, U1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const D2 = await copy('drill', D, T1_SALSA);
		const set = (id: number, v: object) =>
			db
				.update(exercises)
				.set({ comesBack: JSON.stringify(v) })
				.where(eq(exercises.id, id))
				.run();
		const read = (id: number) =>
			JSON.parse(
				db.select().from(exercises).where(eq(exercises.id, id)).get()!.comesBack as string
			);
		set(D, { kind: 'until', good: 3, since: 5 });
		// Onto faces: turned on for the receiver now, not the giver's day.
		expect(apply('drill', D2, D, ['comesBack']).ok).toBe(true);
		expect(read(D2)).toEqual({ kind: 'until', good: 3, since: NOW });
		// Onto an until already running since T: its own start is kept, the count is taken.
		set(D2, { kind: 'until', good: 5, since: T });
		expect(apply('drill', D2, D, ['comesBack']).ok).toBe(true);
		expect(read(D2)).toEqual({ kind: 'until', good: 3, since: T });
	});

	it('a drill’s practice, a song’s count and a lesson’s title land, with the lesson’s exercise', async () => {
		const D = createCustomExercise(db, U1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		const D2 = await copy('drill', D, T1_SALSA);
		db.update(exercises)
			.set({ practiceMode: 'count', countBpm: 90 })
			.where(eq(exercises.id, D))
			.run();
		expect(apply('drill', D2, D, ['practice']).ok).toBe(true);
		expect(db.select().from(exercises).where(eq(exercises.id, D2)).get()).toMatchObject({
			practiceMode: 'count',
			countBpm: 90
		});

		const S = createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 'Chan Chan',
			style: 'salsa'
		}).id;
		db.update(songs).set({ status: 'ready' }).where(eq(songs.id, S)).run();
		const S2 = await copy('song', S, T1_SALSA);
		db.update(songs)
			.set({ anchorsJson: '[4]', tempoFactor: 2, title: 'Chan chan (live)' })
			.where(eq(songs.id, S))
			.run();
		expect(differing('song', S2, S)).toEqual(['title', 'count']);
		expect(apply('song', S2, S, ['count']).ok).toBe(true);
		expect(db.select().from(songs).where(eq(songs.id, S2)).get()).toMatchObject({
			title: 'Chan Chan',
			anchorsJson: '[4]',
			tempoFactor: 2
		});

		const L = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Week 1', notes: null })
			.lesson.id;
		const G = await copy('lesson', L, T1_SALSA);
		db.update(lessons)
			.set({ title: 'Week 2', lessonDay: '2026-11-08', notes: 'Bring water' })
			.where(eq(lessons.id, G))
			.run();
		expect(apply('lesson', L, G, ['title', 'day', 'notes']).ok).toBe(true);
		expect(db.select().from(lessons).where(eq(lessons.id, L)).get()).toMatchObject({
			title: 'Week 2',
			lessonDay: '2026-11-08',
			notes: 'Bring water'
		});
		expect(db.select().from(exercises).where(eq(exercises.lessonId, L)).get()!.name).toContain(
			'Week 2'
		);
	});
});

describe('set members', () => {
	it('URL links: added with the giver’s title, removed to Recently deleted in a group', async () => {
		const { F, M } = await world();
		addLinks(db, { figureId: M }, ['https://example.org/new'], 'New', 'u1');
		const old = db.select().from(links).where(eq(links.figureId, M)).all();
		deleteLink(db, { figureId: M }, old.find((l) => l.url.endsWith('doble'))!.id, 'u1');

		const keys = differing('figure', F, M);
		expect(keys.sort()).toEqual(['link:https://example.org/doble', 'link:https://example.org/new']);
		expect(apply('figure', F, M, keys)).toMatchObject({ ok: true, removals: true });
		expect(
			db
				.select({ url: links.url, title: links.title })
				.from(links)
				.where(eq(links.figureId, F))
				.all()
		).toEqual([{ url: 'https://example.org/new', title: 'New' }]);
		expect(db.select().from(teamTrash).where(eq(teamTrash.kind, 'link')).all()).toHaveLength(1);
	});

	it('a lesson’s hand links: added as the target place’s member (a copy made now), removed', async () => {
		const { F, lesson } = await world();
		const mine = await copy('lesson', lesson, U1_SALSA);
		const myF = memberIn(db, 'figure', geneOf(db, 'figure', F)!, U1_SALSA)!.id;
		const W = figure(T1_SALSA, 'Setenta', 'Básico').figure.id;
		linkFigure(db, lesson, W, 'u1');
		unlinkFigure(db, lesson, F, false, T, 'u1');

		const keys = differing('lesson', mine, lesson);
		expect(keys).toHaveLength(2);
		expect(apply('lesson', mine, lesson, keys)).toMatchObject({ ok: true, removals: true });

		const myW = memberIn(db, 'figure', geneOf(db, 'figure', W)!, U1_SALSA)!.id;
		expect(myW).not.toBe(W);
		const linked = db
			.select({ id: lessonFigures.figureId })
			.from(lessonFigures)
			.where(eq(lessonFigures.lessonId, mine))
			.all()
			.map((r) => r.id);
		expect(linked).toEqual([myW]);
		expect(linked).not.toContain(myF);
		expect(differing('lesson', mine, lesson)).toEqual([]);
	});
});

describe('pieces', () => {
	it('a recording comes in with its section, the section’s link mapped into the place', async () => {
		const { F, M, D, rec } = await world();
		const key = `rec:${geneOf(db, 'recording', rec)}`;
		expect(differing('figure', M, F)).toEqual([]); // skipped: Make it mine brought none
		const linked = new Map([[fileKey('recording', 'g.mp4'), 'copy-g.mp4']]);
		expect(apply('figure', M, F, [key], linked)).toMatchObject({ ok: true, removals: false });

		const [copied] = db.select().from(recordings).where(eq(recordings.figureId, M)).all();
		expect(copied).toMatchObject({ file: 'copy-g.mp4', geneId: geneOf(db, 'recording', rec) });
		const [section] = db
			.select()
			.from(videoSpots)
			.where(eq(videoSpots.recordingId, copied.id))
			.all();
		const [link] = db.select().from(spotLinks).where(eq(spotLinks.spotId, section.id)).all();
		const myD = memberIn(db, 'drill', geneOf(db, 'drill', D)!, U1_SALSA)!.id;
		expect(link.exerciseId).toBe(myD);
		expect(myD).not.toBe(D);
	});

	it('a note, a section’s times and its links update in place; a new section comes, a gone one goes', async () => {
		const { F, M, rec, spot } = await world();
		const linked = new Map([[fileKey('recording', 'g.mp4'), 'copy-g.mp4']]);
		apply('figure', M, F, [`rec:${geneOf(db, 'recording', rec)}`], linked);
		const mine = db.select().from(recordings).where(eq(recordings.figureId, M)).get()!;
		const mySpot = db.select().from(videoSpots).where(eq(videoSpots.recordingId, mine.id)).get()!;
		// u1 adds a point of their own; the group moves its section, notes the take, unlinks Shines.
		addSpot(db, { recordingId: mine.id }, { startMs: 5000, endMs: null, label: 'Mine' }, 'u1');
		db.update(recordings).set({ note: 'Slow take' }).where(eq(recordings.id, rec)).run();
		db.update(videoSpots).set({ startMs: 1500 }).where(eq(videoSpots.id, spot)).run();
		db.delete(spotLinks).where(eq(spotLinks.spotId, spot)).run();
		addSpot(db, { recordingId: rec }, { startMs: 3000, endMs: 4000, label: 'New' }, 'u1');

		const keys = differing('figure', M, F, true);
		expect(keys).toHaveLength(5);
		expect(apply('figure', M, F, keys)).toMatchObject({ ok: true, removals: true });
		expect(db.select().from(recordings).where(eq(recordings.id, mine.id)).get()!.note).toBe(
			'Slow take'
		);
		const spots = db.select().from(videoSpots).where(eq(videoSpots.recordingId, mine.id)).all();
		expect(spots.map((s) => [s.startMs, s.label]).sort()).toEqual([
			[1500, 'Turn'],
			[3000, 'New']
		]);
		expect(spots.find((s) => s.label === 'Turn')!.id).toBe(mySpot.id);
		expect(db.select().from(spotLinks).where(eq(spotLinks.spotId, mySpot.id)).all()).toEqual([]);
		expect(differing('figure', M, F, true)).toEqual([]);
	});

	it('a person’s deleted recording leaves its file to unlink; a group’s goes to Recently deleted', async () => {
		const { F, M } = await world();
		const own = recording(M, 'mine.mp4');
		const ownKey = `rec:#${own}`;
		expect(differing('figure', M, F)).toEqual([ownKey]);
		expect(apply('figure', M, F, [ownKey])).toMatchObject({
			ok: true,
			removals: true,
			unlink: [['recording', 'mine.mp4']]
		});
		expect(db.select().from(recordings).where(eq(recordings.id, own)).get()).toBeUndefined();

		const extra = recording(F, 'extra.mp4');
		const out = apply('figure', F, M, [`rec:#${extra}`]);
		expect(out).toMatchObject({ ok: true, removals: true, unlink: [] });
		expect(db.select().from(teamTrash).where(eq(teamTrash.kind, 'recording')).all()).toHaveLength(
			1
		);
	});

	it('a delete of a linked section is refused, and nothing of that apply lands', async () => {
		const { F, M, rec } = await world();
		db.update(figures).set({ notes: 'Mine' }).where(eq(figures.id, M)).run();
		const key = `rec:${geneOf(db, 'recording', rec)}`;
		const out = apply('figure', F, M, ['notes', key]);
		expect(out).toMatchObject({ ok: false, reason: 'linked' });
		expect(out.ok === false && out.message).toMatch(/^Linked to Shines/);
		expect(db.select().from(figures).where(eq(figures.id, F)).get()!.notes).toBeNull();
		expect(db.select().from(recordings).where(eq(recordings.id, rec)).get()).toBeDefined();
	});
});

describe('slots', () => {
	it('replace the routine’s slot list, each option the target place’s member', async () => {
		const { F } = await world();
		const R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		addFigureSlot(db, R, F, 'u1');
		const mine = await copy('routine', R, U1_SALSA);
		const myF = memberIn(db, 'figure', geneOf(db, 'figure', F)!, U1_SALSA)!.id;
		const W = figure(T1_SALSA, 'Setenta', 'Básico').figure.id;
		addFigureSlot(db, R, W, 'u1');

		expect(differing('routine', mine, R)).toEqual(['slots']);
		expect(apply('routine', mine, R, ['slots'])).toMatchObject({ ok: true, removals: false });
		const myW = memberIn(db, 'figure', geneOf(db, 'figure', W)!, U1_SALSA)!;
		expect(routineSlots(db, mine).map((s) => s.figureIds)).toEqual([[myF], [myW.id]]);
		expect(db.select().from(routines).where(eq(routines.id, mine)).get()).toBeDefined();
		expect(differing('routine', mine, R)).toEqual([]);
		expect(
			db
				.select()
				.from(figures)
				.where(and(eq(figures.id, myW.id), eq(figures.userId, 'u1')))
				.get()
		).toBeDefined();
	});

	it('never clones an embedded routine it would drop: this routine is embedded elsewhere', async () => {
		const { F } = await world();
		const R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		addFigureSlot(db, R, F, 'u1');
		const mine = await copy('routine', R, U1_SALSA);
		const P = createRoutine(db, U1_SALSA, { name: 'Long', notes: null }).routine.id;
		expect(addChildSlot(db, P, mine, 'u1')).not.toBeNull();
		const K = createRoutine(db, T1_SALSA, { name: 'Shine break', notes: null }).routine.id;
		addFigureSlot(db, K, F, 'u1');
		expect(addChildSlot(db, R, K, 'u1')).not.toBeNull();

		expect(apply('routine', mine, R, ['slots']).ok).toBe(true);
		expect(routineSlots(db, mine).map((s) => s.childId)).toEqual([null]);
		expect(
			db
				.select()
				.from(routines)
				.where(and(eq(routines.userId, 'u1'), eq(routines.name, 'Shine break')))
				.all()
		).toEqual([]);
	});
});

describe('a lesson’s hand link, never in both places', () => {
	it('a figure taken in drops the person’s own entry for it from the hand-linked list', async () => {
		const { lesson } = await world();
		const mine = await copy('lesson', lesson, U1_SALSA);
		const W = figure(T1_SALSA, 'Setenta', 'Básico').figure.id;
		const myW = await copy('figure', W, U1_SALSA);
		const entry = addFigureExercise(db, 'u1', myW)!;
		expect(linkExercise(db, mine, entry.id, 'u1')).toBe(true);
		linkFigure(db, lesson, W, 'u1');

		const keys = differing('lesson', mine, lesson);
		expect(apply('lesson', mine, lesson, keys).ok).toBe(true);
		expect(
			db
				.select()
				.from(lessonFigures)
				.where(eq(lessonFigures.lessonId, mine))
				.all()
				.map((r) => r.figureId)
		).toContain(myW);
		expect(
			db.select().from(lessonExercises).where(eq(lessonExercises.lessonId, mine)).all()
		).toEqual([]);
	});
});

describe('positions', () => {
	const groupPosition = (name: string) =>
		db
			.select()
			.from(positions)
			.where(and(eq(positions.teamId, 1), eq(positions.name, name)))
			.get()!.id;
	const ownerOf = (id: number) => {
		const p = db.select().from(positions).where(eq(positions.id, id)).get()!;
		return p.teamId === null ? p.userId : `team ${p.teamId}`;
	};
	const tag = (figureId: number, side: 'start' | 'end', positionId: number) =>
		db
			.insert(side === 'start' ? figureStartPositions : figureEndPositions)
			.values({ figureId, positionId })
			.run();
	const mine = (positionId: number) =>
		memberIn(db, 'position', geneOf(db, 'position', positionId)!, U1_SALSA)?.id ?? null;

	/** The group's F starting in its Cerrada, and u1's copy M (Cerrada copied with it). */
	async function tagged() {
		const F = figure(T1_SALSA, 'Enchufla', 'Doble').figure.id;
		const cerrada = groupPosition('Cerrada');
		tag(F, 'start', cerrada);
		const M = await copy('figure', F, U1_SALSA);
		return { F, M, cerrada };
	}

	it('each owner’s member of one family reads as the same tag: no difference', async () => {
		const { F, M, cerrada } = await tagged();
		const own = mine(cerrada)!;
		expect(own).not.toBe(cerrada);
		expect(ownerOf(own)).toBe('u1');
		expect(figurePositions(db, M)).toEqual({ startIds: [own], endIds: [] });
		expect(differing('figure', M, F)).toEqual([]);
		// Never in step as a pair either: still the same.
		expect(differing('figure', M, F, true)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('Take theirs on an end writes your own member: the one you have, or a copy made now', async () => {
		const { F, M } = await tagged();
		const sombra = groupPosition('Sombra');
		const caida = groupPosition('Caída');
		const ownSombra = await copy('position', sombra, U1_SALSA);
		tag(F, 'end', sombra);
		tag(F, 'end', caida);
		const gs = geneOf(db, 'position', sombra)!;
		const keys = differing('figure', M, F);
		expect(keys.sort()).toEqual([`end:#${caida}`, `end:${gs}`].sort());

		expect(apply('figure', M, F, keys)).toMatchObject({ ok: true, removals: false });
		const ownCaida = mine(caida)!;
		expect(ownerOf(ownCaida)).toBe('u1');
		expect(figurePositions(db, M).endIds).toEqual([ownSombra, ownCaida].sort((a, b) => a - b));
		expect(differing('figure', M, F)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a side the giver dropped goes; a tag of an archived position stays', async () => {
		const { F, M, cerrada } = await tagged();
		const old = await copy('position', groupPosition('Sombra'), U1_SALSA);
		tag(M, 'start', old);
		db.update(positions).set({ archivedAt: T }).where(eq(positions.id, old)).run();
		db.delete(figureStartPositions).where(eq(figureStartPositions.figureId, F)).run();
		const key = `start:${geneOf(db, 'position', cerrada)}`;
		expect(differing('figure', M, F)).toEqual([key]);
		expect(apply('figure', M, F, [key])).toMatchObject({ ok: true });
		expect(figurePositions(db, M)).toEqual({ startIds: [old], endIds: [] });
		expect(differing('figure', M, F)).toEqual([]);
	});

	it('Send a tag of your own position to the group: the group gets its own copy of it', async () => {
		const { F, M } = await tagged();
		const own = db
			.insert(positions)
			.values({ ...ownerValues(U1_SALSA), slug: 'p-own', name: 'Mi posición', hands: 'one' })
			.returning()
			.get().id;
		tag(M, 'end', own);
		expect(differing('figure', F, M)).toEqual([`end:#${own}`]);
		expect(apply('figure', F, M, [`end:#${own}`])).toMatchObject({ ok: true });
		const theirs = memberIn(db, 'position', geneOf(db, 'position', own)!, T1_SALSA)!.id;
		expect(db.select().from(positions).where(eq(positions.id, theirs)).get()).toMatchObject({
			teamId: 1,
			name: 'Mi posición',
			hands: 'one',
			clonedFrom: own
		});
		expect(figurePositions(db, F).endIds).toEqual([theirs]);
		expect(differing('figure', F, M)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('Send a tag whose position cannot be copied (every name taken): refused, nothing written', async () => {
		const { F, M } = await tagged();
		const own = db
			.insert(positions)
			.values({ ...ownerValues(U1_SALSA), slug: 'p-own', name: 'Mi posición' })
			.returning()
			.get().id;
		tag(M, 'end', own);
		const taken = ['Mi posición', 'Mi posición (Ana)'];
		for (let n = 2; n <= 9; n++) taken.push(`Mi posición (Ana ${n})`);
		for (const name of taken)
			db.insert(positions)
				.values({ ...ownerValues(T1_SALSA), slug: `p-${name}`, name })
				.run();
		const before = db.select().from(positions).all().length;
		const out = await syncFrom(
			db,
			'u1',
			'figure',
			F,
			M,
			{ [`end:#${own}`]: 'theirs' },
			digest(flatOf(db, 'figure', F)),
			files,
			NOW,
			Infinity
		);
		expect(out).toEqual({
			ok: false,
			reason: 'name',
			message: 'Salsa Tuesdays already has a position called Mi posición.'
		});
		expect(db.select().from(positions).all()).toHaveLength(before);
		expect(figurePositions(db, F).endIds).toEqual([]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('a position’s name, type, hold and notes land in place; a taken name is refused', async () => {
		const P = groupPosition('Cerrada');
		const mineP = await copy('position', P, U1_SALSA);
		db.update(positions)
			.set({
				name: 'Cerrada baja',
				styleTag: 'son',
				hands: 'two',
				crossed: true,
				facing: 'face',
				frame: 'closed',
				notes: 'Low'
			})
			.where(eq(positions.id, P))
			.run();
		const keys = differing('position', mineP, P);
		expect(keys).toEqual(['name', 'notes', 'type', 'hands', 'crossed', 'facing', 'frame']);

		db.insert(positions)
			.values({ ...ownerValues(U1_SALSA), slug: 'p-taken', name: 'cerrada BAJA' })
			.run();
		expect(apply('position', mineP, P, ['notes', 'name'])).toEqual({
			ok: false,
			reason: 'name',
			message: 'You already have a position called Cerrada baja.'
		});
		expect(db.select().from(positions).where(eq(positions.id, mineP)).get()!.notes).toBeNull();

		const out = apply('position', mineP, P, keys.slice(1));
		expect(out).toMatchObject({ ok: true, removals: false });
		expect(db.select().from(positions).where(eq(positions.id, mineP)).get()).toMatchObject({
			name: 'Cerrada',
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: 'Low'
		});
		expect(differing('position', mineP, P)).toEqual(['name']);
	});

	it('Send a position’s fields to the group: one History change line', async () => {
		const P = groupPosition('Cerrada');
		const mineP = await copy('position', P, U1_SALSA);
		db.update(positions).set({ hands: 'one' }).where(eq(positions.id, mineP)).run();
		const seen = digest(flatOf(db, 'position', P));
		const out = await syncFrom(
			db,
			'u1',
			'position',
			P,
			mineP,
			{ hands: 'theirs' },
			seen,
			files,
			NOW,
			Infinity
		);
		expect(out).toEqual({ ok: true });
		expect(db.select().from(positions).where(eq(positions.id, P)).get()!.hands).toBe('one');
		const [line] = db
			.select()
			.from(teamChanges)
			.where(and(eq(teamChanges.rootKind, 'position'), eq(teamChanges.verb, 'change')))
			.all();
		expect(line).toMatchObject({ rootId: P, actorId: 'u1' });
	});

	it('a lesson’s hand-linked position and a section’s position link: added as your member, removed', async () => {
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
			.lesson.id;
		const video = addLessonVideo(
			db,
			{ lessonId: L, file: 'v.mp4', mime: 'video/mp4', sizeBytes: 9 },
			'u1'
		).id;
		const spot = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 900, label: 'Turn' },
			'u1'
		)!.id;
		const r = await cloneInto(
			db,
			{ kind: 'lesson', id: L, into: U1_SALSA, recordings: false },
			files,
			T
		);
		if (!r.ok) throw new Error('expected a copy');
		const myL = r.id;
		const cerrada = groupPosition('Cerrada');
		expect(linkPosition(db, L, cerrada, 'u1')).toBe(true);
		linkPositionInSpace(db, T1_SALSA, spot, cerrada);

		const keys = differing('lesson', myL, L);
		expect(keys).toHaveLength(2);
		expect(apply('lesson', myL, L, keys)).toMatchObject({ ok: true, removals: false });
		const own = mine(cerrada)!;
		expect(ownerOf(own)).toBe('u1');
		expect(
			db
				.select({ id: lessonPositions.positionId })
				.from(lessonPositions)
				.where(eq(lessonPositions.lessonId, myL))
				.all()
		).toEqual([{ id: own }]);
		const myVideo = db.select().from(lessonVideos).where(eq(lessonVideos.lessonId, myL)).get()!;
		const mySpot = db
			.select()
			.from(videoSpots)
			.where(eq(videoSpots.lessonVideoId, myVideo.id))
			.get()!;
		expect(
			db
				.select({ id: spotPositionLinks.positionId })
				.from(spotPositionLinks)
				.where(eq(spotPositionLinks.spotId, mySpot.id))
				.all()
		).toEqual([{ id: own }]);
		expect(differing('lesson', myL, L)).toEqual([]);
		expect(crossRefs(db)).toEqual([]);

		// The group takes both off: so does the person's copy, on Take.
		unlinkPosition(db, L, cerrada, true, T, 'u1');
		const gone = differing('lesson', myL, L);
		expect(gone).toHaveLength(2);
		expect(apply('lesson', myL, L, gone)).toMatchObject({ ok: true, removals: true });
		expect(
			db.select().from(lessonPositions).where(eq(lessonPositions.lessonId, myL)).all()
		).toEqual([]);
		expect(
			db.select().from(spotPositionLinks).where(eq(spotPositionLinks.spotId, mySpot.id)).all()
		).toEqual([]);
		expect(differing('lesson', myL, L)).toEqual([]);
	});
});
