import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNotNull } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, lessonAdds, lessonExercises, lessons, routineStepOptions } from './db/schema';
import { createTeam, joinTeam } from './teams';
import {
	addLesson,
	addOffer,
	entryFor,
	markSeen,
	newInLesson,
	removeLesson,
	type EntryTarget
} from './entries';
import { addFigureExercise, archiveVariation, createFigure, getFigure } from './figures';
import { archiveExercise, createCustomExercise, getExercise, updateExercise } from './exercises';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	getLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson,
	unlinkExercise,
	unlinkFigure,
	unlinkRoutine
} from './lessons';
import { addSpot } from './spots';
import { linkInSpace, unlinkFromSection, unlinkSpot } from './spot-links';
import {
	addFigureSlot,
	archiveRoutine,
	createRoutine,
	deleteSlots,
	removeOption
} from './routines';
import { T1_SALSA, T2_SALSA, U1_SALSA } from './test-walls';

// Team T1 has a lesson, a routine, a variation and a drill; u1 and u2 each
// practise every one of them with their own entry (different `everyDays`).

let db: Db;
let lessonId: number;
let routineId: number;
let figureId: number;
let drillId: number;

function entry(userId: string, source: 'lesson' | 'routine' | 'figure' | 'added', target: number) {
	const everyDays = userId === 'u1' ? 2 : userId === 'u2' ? 5 : 9;
	const column = {
		lesson: { lessonId: target },
		routine: { routineId: target },
		figure: { figureId: target },
		added: { drillId: target }
	}[source];
	return db
		.insert(exercises)
		.values({ name: `${source} ${userId}`, source, dance: 'salsa', userId, everyDays, ...column })
		.returning()
		.get();
}

beforeEach(() => {
	db = openDb(':memory:');
	lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-09-22', title: 'Class', notes: null })
		.lesson.id;
	routineId = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
	figureId = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	drillId = db
		.insert(exercises)
		.values({ name: 'Drill', source: 'custom', dance: 'salsa', teamId: 1 })
		.returning()
		.get().id;
	for (const u of ['u1', 'u2']) {
		entry(u, 'lesson', lessonId);
		entry(u, 'routine', routineId);
		entry(u, 'figure', figureId);
		entry(u, 'added', drillId);
	}
	linkFigure(db, lessonId, figureId, 'u1');
});

describe('entryFor', () => {
	// Catches: dropping the userId condition returns whichever entry came first.
	it('returns only the asked person’s entry for every kind of target', () => {
		for (const target of [{ lessonId }, { routineId }, { figureId }, { drillId }]) {
			expect(entryFor(db, 'u2', target)).toMatchObject({ userId: 'u2', everyDays: 5 });
			expect(entryFor(db, 'u1', target)).toMatchObject({ userId: 'u1', everyDays: 2 });
			expect(entryFor(db, 'u3', target)).toBeNull();
		}
	});
});

describe('getLesson', () => {
	// Catches: a lesson page showing u1's settings to u2.
	it('shows the viewer’s own review entry', () => {
		expect(getLesson(db, lessonId, 'u2')!.exercise!.everyDays).toBe(5);
		expect(getLesson(db, lessonId, 'u1')!.exercise!.everyDays).toBe(2);
		expect(getLesson(db, lessonId, 'u3')!.exercise).toBeNull();
	});

	// Catches: the figure's leftJoin without the person duplicating the figure row.
	it('holds one row per figure, with the viewer’s exerciseId', () => {
		const mine = entryFor(db, 'u2', { figureId })!;
		const rows = getLesson(db, lessonId, 'u2')!.figures;
		expect(rows).toHaveLength(1);
		expect(rows[0].exerciseId).toBe(mine.id);
		expect(getLesson(db, lessonId, 'u3')!.figures[0].exerciseId).toBeNull();
	});
});

describe('getFigure', () => {
	// Catches: the figure page showing someone else's practice.
	it('returns the viewer’s entry', () => {
		expect(getFigure(db, figureId, 'u1')!.exercise!.userId).toBe('u1');
		expect(getFigure(db, figureId, 'u2')!.exercise!.everyDays).toBe(5);
	});
});

describe('addFigureExercise', () => {
	// T1 for real: u1 owns it, u2 is a member, and the class lesson is published
	// and added by both: an entry on a group's variation needs it in a lesson the
	// person added (ruling R8), not just read access.
	beforeEach(() => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		joinTeam(db, 'u2', 1, 2);
		db.update(lessons).set({ publishedAt: 3 }).where(eq(lessons.id, lessonId)).run();
		for (const userId of ['u1', 'u2']) {
			db.insert(lessonAdds).values({ userId, lessonId, addedAt: 3, seenAt: 3 }).run();
		}
	});

	// Catches: "someone already has one" refusing a second person, or the entry copying figure.userId.
	it('lets a second person add theirs on a group figure, owned by them', () => {
		const other = createFigure(db, T1_SALSA, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		linkFigure(db, lessonId, other, 'u1');
		const first = addFigureExercise(db, 'u1', other)!;
		const second = addFigureExercise(db, 'u2', other)!;
		expect(first.userId).toBe('u1');
		expect(second.userId).toBe('u2');
		expect(second.id).not.toBe(first.id);
		expect(addFigureExercise(db, 'u2', other)).toBeNull();
	});

	// Catches: inserting a second row instead of reviving the archived one (and its sets).
	it('unarchives the person’s archived entry instead of inserting', () => {
		const mine = entryFor(db, 'u1', { figureId })!;
		db.update(exercises).set({ archivedAt: 5 }).where(eq(exercises.id, mine.id)).run();
		const back = addFigureExercise(db, 'u1', figureId)!;
		expect(back.id).toBe(mine.id);
		expect(back.archivedAt).toBeNull();
		expect(db.select().from(exercises).where(eq(exercises.figureId, figureId)).all()).toHaveLength(
			2
		);
	});

	// Catches: a posted id handing anyone an entry on a group figure they cannot read (risk 21),
	// and an editor's entry on a draft-only figure that reconcile would archive (R8).
	it('refuses a group figure in no added lesson — the editor’s too — and an outsider any', () => {
		const unpublished = createFigure(db, T1_SALSA, {
			figureName: 'Not yet taught',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(addFigureExercise(db, 'u2', unpublished)).toBeNull();
		expect(addFigureExercise(db, 'u4', figureId)).toBeNull();
		expect(addFigureExercise(db, 'u1', unpublished)).toBeNull();
	});

	// Catches: read access alone being enough (R8): a published lesson the member
	// has not added does not let them practise its figure.
	it('refuses a figure of a published lesson the person has not added', () => {
		const other = createLesson(db, T1_SALSA, { lessonDay: '2026-09-29', title: 'Two', notes: null })
			.lesson.id;
		db.update(lessons).set({ publishedAt: 4 }).where(eq(lessons.id, other)).run();
		const taught = createFigure(db, T1_SALSA, {
			figureName: 'Only in two',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		linkFigure(db, other, taught, 'u1');
		expect(addFigureExercise(db, 'u2', taught)).toBeNull();
		db.insert(lessonAdds).values({ userId: 'u2', lessonId: other, addedAt: 5, seenAt: 5 }).run();
		expect(addFigureExercise(db, 'u2', taught)!.userId).toBe('u2');
	});

	// Catches: handing a person an entry on someone else's personal figure.
	it('refuses another person’s own figure', () => {
		const theirs = createFigure(db, U1_SALSA, {
			figureName: 'Mine',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(addFigureExercise(db, 'u2', theirs)).toBeNull();
		expect(addFigureExercise(db, 'u1', theirs)!.userId).toBe('u1');
	});
});

describe('archive cascades', () => {
	// Catches: the cascade re-stamping an already archived entry, which Restore would then revive.
	it('keeps an earlier archivedAt on an entry removed before the lesson', () => {
		const u3 = entry('u3', 'lesson', lessonId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		expect(archiveLesson(db, lessonId, 2000, 'u1')).toBe(true);
		expect(entryFor(db, 'u3', { lessonId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u1', { lessonId })!.archivedAt).toBe(2000);
	});

	it('does the same for a routine', () => {
		const u3 = entry('u3', 'routine', routineId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		archiveRoutine(db, routineId, 2000, 'u1');
		expect(entryFor(db, 'u3', { routineId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u2', { routineId })!.archivedAt).toBe(2000);
	});

	it('does the same for a variation', () => {
		const u3 = entry('u3', 'figure', figureId);
		db.update(exercises).set({ archivedAt: 1000 }).where(eq(exercises.id, u3.id)).run();
		archiveVariation(db, figureId, 2000, 'u1');
		expect(entryFor(db, 'u3', { figureId })!.archivedAt).toBe(1000);
		expect(entryFor(db, 'u1', { figureId })!.archivedAt).toBe(2000);
	});
});

describe('getLesson rows through other joins', () => {
	// Catches: dropping entryJoin on the routine rows duplicates the routine or shows u1's everyDays.
	it('holds one routine row, with the viewer’s exerciseId and everyDays', () => {
		linkRoutine(db, lessonId, routineId, 'u1');
		const rows = getLesson(db, lessonId, 'u2')!.routines;
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			exerciseId: entryFor(db, 'u2', { routineId })!.id,
			everyDays: 5
		});
		expect(getLesson(db, lessonId, 'u3')!.routines[0].exerciseId).toBeNull();
	});

	// Catches: dropping entryJoin on the section-derived figure join duplicates the row or returns the other person's.
	it('holds one row for a variation reached only through a section', () => {
		const other = createFigure(db, T1_SALSA, {
			figureName: 'Setenta',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		entry('u1', 'figure', other);
		const mine = entry('u2', 'figure', other);
		const video = addLessonVideo(
			db,
			{ lessonId, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		);
		const spot = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 1000, endMs: 5000, label: 'X' },
			'u1'
		)!;
		linkInSpace(db, T1_SALSA, spot.id, { figureId: other });
		const rows = getLesson(db, lessonId, 'u2')!.figures.filter((f) => f.id === other);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ byHand: false, exerciseId: mine.id });
	});
});

describe('linkFigure and linkRoutine sweeps', () => {
	// Catches: sweeping by target alone removes other people's hand links, or none of the owner's.
	it('sweeps only the personal lesson owner’s entry out of lesson_exercises', () => {
		const lesson = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-23',
			title: 'Mine',
			notes: null
		}).lesson.id;
		const figure = createFigure(db, U1_SALSA, {
			figureName: 'Own',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const routine = createRoutine(db, U1_SALSA, { name: 'Own show', notes: null }).routine.id;
		const hand = (exerciseId: number) =>
			db.insert(lessonExercises).values({ lessonId: lesson, exerciseId }).run();
		const stranger = entry('u2', 'figure', figure);
		const mine = addFigureExercise(db, 'u1', figure)!;
		const myRoutine = entryFor(db, 'u1', { routineId: routine })!;
		const strangerRoutine = entry('u2', 'routine', routine);
		for (const id of [mine.id, stranger.id, myRoutine.id, strangerRoutine.id]) hand(id);

		expect(linkFigure(db, lesson, figure)).toBe(true);
		expect(linkRoutine(db, lesson, routine)).toBe(true);

		const left = db
			.select({ id: lessonExercises.exerciseId })
			.from(lessonExercises)
			.where(and(eq(lessonExercises.lessonId, lesson)))
			.all()
			.map((r) => r.id);
		expect(left.sort()).toEqual([stranger.id, strangerRoutine.id].sort());
	});
});

describe('adding a group lesson', () => {
	// A real team: u1 owns it, u2 and u3 are members. Lessons P and Q are
	// published; P holds routine R, drill D and variation F; Q holds D too.
	// Lesson `draft` is not published.
	let P: number;
	let Q: number;
	let draft: number;
	let R: number;
	let D: number;
	let F: number;
	const none = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
	const all = () => ({ lesson: true, routineIds: [R], drillIds: [D], figureIds: [F] });
	const live = (userId: string, target: EntryTarget) => {
		const e = entryFor(db, userId, target);
		return e !== null && e.archivedAt === null;
	};
	const variation = (figureName: string) =>
		createFigure(db, T1_SALSA, {
			figureName,
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
	const drill = (name: string) =>
		createCustomExercise(db, T1_SALSA, { name, everyDays: 3, notes: 'Editor notes' }).id;

	beforeEach(() => {
		db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		joinTeam(db, 'u2', 1, 2);
		joinTeam(db, 'u3', 1, 2);
		const lesson = (title: string) =>
			createLesson(db, T1_SALSA, { lessonDay: '2026-10-01', title, notes: null }).lesson.id;
		P = lesson('P');
		Q = lesson('Q');
		draft = lesson('Draft');
		publishLesson(db, T1_SALSA, P, 3);
		publishLesson(db, T1_SALSA, Q, 3);
		R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
		D = drill('Clave');
		F = variation('Enchufla');
		linkRoutine(db, P, R, 'u1');
		linkExercise(db, P, D, 'u1');
		linkExercise(db, Q, D, 'u1');
		linkFigure(db, P, F, 'u1');
	});

	describe('addOffer', () => {
		it('ticks the lesson, routines and drills, never the figures', () => {
			const offer = addOffer(db, 'u2', P)!;
			expect(offer.counts).toEqual({ videos: 0, sections: 0, figures: 1, routines: 1, drills: 1 });
			expect(offer.items).toEqual([
				{ kind: 'lesson', id: P, name: 'P', ticked: true },
				{ kind: 'routine', id: R, name: 'Show', ticked: true },
				{ kind: 'drill', id: D, name: 'Clave', ticked: true },
				{ kind: 'figure', id: F, name: 'Enchufla · Basic', ticked: false }
			]);
		});

		// Catches: offering what a member may not read.
		it('offers nothing for a draft, or to an outsider', () => {
			expect(addOffer(db, 'u2', draft)).toBeNull();
			expect(addOffer(db, 'u4', P)).toBeNull();
		});
	});

	describe('addLesson', () => {
		// Catches: inferring "added" from entries, or ticking what was not picked (risk 4).
		it('with only a drill picked writes the add and only the drill entry', () => {
			expect(addLesson(db, 'u2', P, { ...none, drillIds: [D] }, 10)).toBe(true);
			expect(db.select().from(lessonAdds).where(eq(lessonAdds.userId, 'u2')).all()).toEqual([
				{ userId: 'u2', lessonId: P, addedAt: 10, seenAt: 10 }
			]);
			const mine = db.select().from(exercises).where(eq(exercises.userId, 'u2')).all();
			expect(mine).toHaveLength(1);
			expect(mine[0]).toMatchObject({
				source: 'added',
				drillId: D,
				name: 'Clave',
				dance: 'salsa',
				notes: null,
				songId: null,
				teamId: null
			});
		});

		// Catches: a second insert tripping the unique index.
		it('run twice leaves one entry per target', () => {
			expect(addLesson(db, 'u2', P, all(), 10)).toBe(true);
			expect(addLesson(db, 'u2', P, all(), 20)).toBe(true);
			const mine = db.select().from(exercises).where(eq(exercises.userId, 'u2')).all();
			expect(mine.map((e) => e.source).sort()).toEqual(['added', 'figure', 'lesson', 'routine']);
			expect(mine.find((e) => e.source === 'lesson')!.name).toBe('Review: P');
		});

		// Catches: a re-add inserting new rows, so the old sets are lost to the person.
		it('after Remove gives back the same entries', () => {
			addLesson(db, 'u2', P, all(), 10);
			const before = db.select().from(exercises).where(eq(exercises.userId, 'u2')).all();
			removeLesson(db, 'u2', P, 20);
			addLesson(db, 'u2', P, all(), 30);
			const after = db.select().from(exercises).where(eq(exercises.userId, 'u2')).all();
			expect(after.map((e) => e.id).sort()).toEqual(before.map((e) => e.id).sort());
			expect(after.every((e) => e.archivedAt === null)).toBe(true);
		});

		// Catches: songs crossing people (risk 8).
		it('starts a song drill’s entry in song mode with no song', () => {
			db.update(exercises)
				.set({ practiceMode: 'song', countBpm: null })
				.where(eq(exercises.id, D))
				.run();
			addLesson(db, 'u2', P, { ...none, drillIds: [D] }, 10);
			expect(entryFor(db, 'u2', { drillId: D })).toMatchObject({
				practiceMode: 'song',
				songId: null
			});
		});

		it('copies a count drill’s tempo', () => {
			db.update(exercises)
				.set({ practiceMode: 'count', countBpm: 180 })
				.where(eq(exercises.id, D))
				.run();
			addLesson(db, 'u2', P, { ...none, drillIds: [D] }, 10);
			expect(entryFor(db, 'u2', { drillId: D })).toMatchObject({
				practiceMode: 'count',
				countBpm: 180
			});
		});

		// Catches: the entry's practice panel opening without the drill's pattern, clave and speed (R11).
		it('copies the drill’s practice settings', () => {
			const config = JSON.stringify({ pattern: 'son', clave: true, speed: 0.75 });
			db.update(exercises).set({ practiceJson: config }).where(eq(exercises.id, D)).run();
			addLesson(db, 'u2', P, { ...none, drillIds: [D] }, 10);
			expect(entryFor(db, 'u2', { drillId: D })!.practiceJson).toBe(config);
		});

		// Catches: a posted id handing out a draft lesson or another group's drill (risk 21).
		it('refuses a draft and an outsider, and ignores picks outside the lesson', () => {
			const draftDrill = drill('Draft drill');
			linkExercise(db, draft, draftDrill, 'u1');
			expect(addLesson(db, 'u2', draft, { ...all(), drillIds: [draftDrill] }, 10)).toBe(false);
			expect(addLesson(db, 'u4', P, all(), 10)).toBe(false);
			expect(db.select().from(lessonAdds).all()).toEqual([]);
			expect(db.select().from(exercises).where(isNotNull(exercises.userId)).all()).toEqual([]);

			createTeam(db, 'u1', 'salsa', 'Other group', 4);
			const foreign = createCustomExercise(db, T2_SALSA, {
				name: 'Theirs',
				everyDays: 3,
				notes: null
			}).id;
			const unlinked = drill('Not in P');
			expect(addLesson(db, 'u2', P, { ...none, drillIds: [foreign, unlinked] }, 10)).toBe(true);
			expect(entryFor(db, 'u2', { drillId: foreign })).toBeNull();
			expect(entryFor(db, 'u2', { drillId: unlinked })).toBeNull();
		});
	});

	describe('removeLesson', () => {
		// Catches: Remove taking a drill that another added lesson still holds (risk 5).
		it('keeps a drill another added lesson holds, until that one goes too', () => {
			addLesson(db, 'u2', P, all(), 10);
			addLesson(db, 'u2', Q, { ...none, drillIds: [D] }, 10);
			expect(removeLesson(db, 'u2', P, 20)).toBe(true);
			expect(live('u2', { drillId: D })).toBe(true);
			expect(entryFor(db, 'u2', { lessonId: P })!.archivedAt).toBe(20);
			expect(entryFor(db, 'u2', { routineId: R })!.archivedAt).toBe(20);
			expect(entryFor(db, 'u2', { figureId: F })!.archivedAt).toBe(20);
			expect(removeLesson(db, 'u2', Q, 30)).toBe(true);
			expect(entryFor(db, 'u2', { drillId: D })!.archivedAt).toBe(30);
			expect(db.select().from(lessonAdds).all()).toEqual([]);
		});

		// Catches: one person's Remove reaching another's entries.
		it('touches only the person removing', () => {
			addLesson(db, 'u2', P, all(), 10);
			addLesson(db, 'u3', P, all(), 10);
			removeLesson(db, 'u2', P, 20);
			expect(live('u3', { drillId: D })).toBe(true);
			expect(live('u3', { lessonId: P })).toBe(true);
		});
	});

	describe('newInLesson', () => {
		it('lists a drill linked after the add, until markSeen', () => {
			addLesson(db, 'u2', P, all(), 10);
			expect(newInLesson(db, 'u2', P)).toEqual([]);
			const later = drill('Shines');
			linkExercise(db, P, later, 'u1');
			expect(newInLesson(db, 'u2', P)).toEqual([
				{ kind: 'drill', id: later, name: 'Shines', ticked: true }
			]);
			expect(markSeen(db, 'u2', P, Date.now() + 1)).toBe(true);
			expect(newInLesson(db, 'u2', P)).toEqual([]);
		});

		// Catches: an unticked drill nagging forever, or "new" for someone who never added.
		it('ignores what was there at the add, and a person who has not added', () => {
			addLesson(db, 'u2', P, none, Date.now() + 1000);
			expect(newInLesson(db, 'u2', P)).toEqual([]);
			expect(newInLesson(db, 'u3', P)).toEqual([]);
		});

		// Catches: Add on a drill's page (one pick) clearing the lesson's other new items.
		it('touch: false adds one pick and keeps the rest new, the add row as it was', () => {
			addLesson(db, 'u2', Q, { ...none, drillIds: [D] }, 10);
			const R2 = createRoutine(db, T1_SALSA, { name: 'Second', notes: null }).routine.id;
			linkRoutine(db, Q, R2, 'u1');
			const D2 = drill('Footwork');
			linkExercise(db, Q, D2, 'u1');
			expect(newInLesson(db, 'u2', Q).map((i) => i.id)).toEqual([R2, D2]);
			expect(
				addLesson(db, 'u2', Q, { ...none, drillIds: [D2] }, Date.now() + 1000, { touch: false })
			).toBe(true);
			expect(entryFor(db, 'u2', { drillId: D2 })!.archivedAt).toBeNull();
			expect(newInLesson(db, 'u2', Q)).toEqual([
				{ kind: 'routine', id: R2, name: 'Second', ticked: true }
			]);
			expect(
				db
					.select()
					.from(lessonAdds)
					.where(and(eq(lessonAdds.userId, 'u2'), eq(lessonAdds.lessonId, Q)))
					.get()
			).toMatchObject({ addedAt: 10, seenAt: 10 });
		});

		// Catches: offering a routine or drill the person already practises.
		it('leaves out what the person already has live', () => {
			addLesson(db, 'u2', Q, { ...none, drillIds: [D] }, 10);
			const R2 = createRoutine(db, T1_SALSA, { name: 'Second', notes: null }).routine.id;
			linkRoutine(db, Q, R2, 'u1');
			expect(newInLesson(db, 'u2', Q)).toEqual([
				{ kind: 'routine', id: R2, name: 'Second', ticked: true }
			]);
			addLesson(db, 'u2', Q, { ...none, routineIds: [R2] }, 5);
			expect(newInLesson(db, 'u2', Q)).toEqual([]);
		});
	});

	describe('a drill’s rename and archive reach its entries', () => {
		it('renames u2’s entry with the drill', () => {
			addLesson(db, 'u2', P, all(), 10);
			updateExercise(db, D, { name: 'Clave 2-3', everyDays: 3, active: true, notes: null }, 'u1');
			expect(entryFor(db, 'u2', { drillId: D })!.name).toBe('Clave 2-3');
		});

		it('archives every entry with the drill’s now, keeping an earlier one', () => {
			addLesson(db, 'u2', P, all(), 10);
			addLesson(db, 'u3', P, all(), 10);
			const u3 = entryFor(db, 'u3', { drillId: D })!;
			db.update(exercises).set({ archivedAt: 15 }).where(eq(exercises.id, u3.id)).run();
			expect(archiveExercise(db, D, 40, 'u1')).toBe(true);
			expect(entryFor(db, 'u2', { drillId: D })!.archivedAt).toBe(40);
			expect(entryFor(db, 'u3', { drillId: D })!.archivedAt).toBe(15);
		});

		// Catches: renaming or archiving an entry through the drill forms.
		it('refuses to rename or archive an entry itself', () => {
			addLesson(db, 'u2', P, all(), 10);
			const mine = entryFor(db, 'u2', { drillId: D })!;
			updateExercise(db, mine.id, { name: 'Mine now', everyDays: 4, active: true, notes: null });
			expect(entryFor(db, 'u2', { drillId: D })).toMatchObject({ name: 'Clave', everyDays: 4 });
			expect(archiveExercise(db, mine.id, 50)).toBe(false);
			expect(live('u2', { drillId: D })).toBe(true);
		});
	});

	describe('reconcileEntries: taken out means off Today (risk 25)', () => {
		// Catches: an unlinked drill staying on a member's Today.
		it('an editor unlinking D from P archives u2’s entry; relinking offers it as new', () => {
			addLesson(db, 'u2', P, all(), 10);
			unlinkExercise(db, P, D, false, Date.now(), 'u1');
			expect(entryFor(db, 'u2', { drillId: D })!.archivedAt).not.toBeNull();
			expect(live('u2', { lessonId: P })).toBe(true);
			linkExercise(db, P, D, 'u1');
			expect(newInLesson(db, 'u2', P)).toEqual([
				{ kind: 'drill', id: D, name: 'Clave', ticked: true }
			]);
		});

		it('keeps the entry while another added lesson holds it', () => {
			addLesson(db, 'u2', P, all(), 10);
			addLesson(db, 'u2', Q, none, 10);
			unlinkExercise(db, P, D, false, Date.now(), 'u1');
			expect(live('u2', { drillId: D })).toBe(true);
		});

		it('follows unlinking a figure and a routine', () => {
			addLesson(db, 'u2', P, all(), 10);
			unlinkFigure(db, P, F, false, Date.now(), 'u1');
			expect(live('u2', { figureId: F })).toBe(false);
			unlinkRoutine(db, P, R, Date.now(), 'u1');
			expect(live('u2', { routineId: R })).toBe(false);
		});

		it('follows archiving a lesson, a routine, a variation', () => {
			addLesson(db, 'u2', P, all(), 10);
			addLesson(db, 'u3', Q, { ...none, drillIds: [D] }, 10);
			archiveRoutine(db, R, 50, 'u1');
			expect(entryFor(db, 'u2', { routineId: R })!.archivedAt).toBe(50);
			archiveVariation(db, F, 60, 'u1');
			expect(entryFor(db, 'u2', { figureId: F })!.archivedAt).toBe(60);
			expect(archiveLesson(db, P, 70, 'u1')).toBe(true);
			expect(entryFor(db, 'u2', { lessonId: P })!.archivedAt).toBe(70);
			expect(entryFor(db, 'u2', { drillId: D })!.archivedAt).toBe(70);
			expect(live('u3', { drillId: D })).toBe(true);
		});

		it('follows removing a section link', () => {
			const D2 = drill('Footwork');
			const video = addLessonVideo(
				db,
				{
					lessonId: P,
					file: 'p.mp4',
					mime: 'video/mp4',
					sizeBytes: 1
				},
				'u1'
			);
			const spot = addSpot(
				db,
				{ lessonVideoId: video.id },
				{ startMs: 0, endMs: 4000, label: 'A' },
				'u1'
			)!;
			const link = linkInSpace(db, T1_SALSA, spot.id, { exerciseId: D2 });
			addLesson(db, 'u2', P, { ...none, drillIds: [D2] }, 10);
			expect(live('u2', { drillId: D2 })).toBe(true);
			expect(unlinkSpot(db, link, { exerciseId: D2 }, Date.now(), 'u1')).toBe(true);
			expect(live('u2', { drillId: D2 })).toBe(false);

			const again = linkInSpace(db, T1_SALSA, spot.id, { exerciseId: D2 });
			addLesson(db, 'u2', P, { ...none, drillIds: [D2] }, 20);
			expect(live('u2', { drillId: D2 })).toBe(true);
			expect(unlinkFromSection(db, spot.id, again, false, Date.now(), 'u1')).toBe(true);
			expect(live('u2', { drillId: D2 })).toBe(false);
		});

		it('follows removing a slot option and deleting a slot', () => {
			const F2 = variation('Dile que no');
			const F3 = variation('Setenta');
			const step = addFigureSlot(db, R, F2, 'u1')!;
			db.insert(routineStepOptions).values({ stepId: step, figureId: F3 }).run();
			addLesson(db, 'u2', P, { ...none, figureIds: [F2, F3] }, 10);
			expect(live('u2', { figureId: F3 })).toBe(true);
			expect(removeOption(db, step, F3, Date.now(), 'u1')).toBe(true);
			expect(live('u2', { figureId: F3 })).toBe(false);
			expect(live('u2', { figureId: F2 })).toBe(true);
			expect(deleteSlots(db, R, [step], Date.now(), 'u1')).not.toBeNull();
			expect(live('u2', { figureId: F2 })).toBe(false);
		});

		// Catches: a reconcile in a person's own space archiving their own practice.
		it('leaves a person’s own entries alone', () => {
			const lesson = createLesson(db, U1_SALSA, {
				lessonDay: '2026-10-02',
				title: 'Mine',
				notes: null
			}).lesson.id;
			const mine = createCustomExercise(db, U1_SALSA, { name: 'Own', everyDays: 3, notes: null });
			linkExercise(db, lesson, mine.id);
			unlinkExercise(db, lesson, mine.id);
			archiveLesson(db, lesson, 80);
			expect(getExercise(db, mine.id)!.archivedAt).toBeNull();
		});
	});
});
