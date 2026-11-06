/**
 * Auto-add (levels spec): a class's lessons reach a member's Today by
 * themselves — on publish, on joining (the newest only), and when a lesson
 * they have gains something to practise — exactly as Add with the default
 * picks would, never twice, and never a lesson they removed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import {
	exercises,
	lessonAdds,
	lessonExercises,
	spotLinks,
	teamMembers,
	teamTrash,
	users
} from './db/schema';
import { createTeam } from './teams';
import { addLesson, addOffer, defaultPicks, entryFor, removeLesson } from './entries';
import { createFigure } from './figures';
import { createCustomExercise } from './exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkFigure,
	linkRoutine,
	publishLesson
} from './lessons';
import { createRoutine } from './routines';
import { addSpot } from './spots';
import { linkInSpace, unlinkSpot } from './spot-links';
import { restoreTrash } from './trash';
import { createAndLinkIn } from './link-popup';
import { setAutoAdd, setLevel } from './levels';
import { crossRefs } from './integrity';
import { cloneInto } from './clones/clone';
import { compareWith, takeTheirs } from './clones/compare';
import { autoAddOnJoin, autoAddOnPublish, autoAddPending, joinClass } from './auto-add';
import { NO_FILES, T1_SALSA, U1_SALSA } from './test-walls';
import type { Level } from '$lib/levels/levels';

/** Well before the real clock: a link a mutation makes (stamped `Date.now()`) is after it. */
const T = Date.UTC(2001, 0, 1);

let db: Db;

/**
 * Salsa Tuesdays (T1), owned by u1 (the teacher, Everything). Its members:
 * u2 Follow my class, u3 Practise and keep my own, u4 Everything, u5
 * Everything with the toggle on, u6 Practise and keep my own with it off,
 * u7 not chosen yet. The class lesson L holds a routine R and a drill D by
 * hand and a variation F; it is a draft until a test publishes it.
 */
let L: number;
let R: number;
let D: number;
let F: number;

const MEMBERS: [string, Level | null, number | null][] = [
	['u2', 'follow', null],
	['u3', 'own', null],
	['u4', 'all', null],
	['u5', 'all', 1],
	['u6', 'own', 0],
	['u7', null, null]
];

function person(id: string) {
	db.insert(users)
		.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
		.run();
}

function member(id: string, level: Level | null, toggle: number | null) {
	person(id);
	if (level) setLevel(db, id, level);
	db.insert(teamMembers).values({ teamId: 1, userId: id, role: 'member', joinedAt: T }).run();
	if (toggle !== null) setAutoAdd(db, id, 1, toggle === 1);
}

beforeEach(() => {
	db = openDb(':memory:');
	person('u1');
	setLevel(db, 'u1', 'all');
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	for (const [id, level, toggle] of MEMBERS) member(id, level, toggle);
	L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tuesday', notes: null }).lesson
		.id;
	R = createRoutine(db, T1_SALSA, { name: 'Show', notes: null }).routine.id;
	D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
	F = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Doble',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	linkRoutine(db, L, R, 'u1');
	linkExercise(db, L, D, 'u1');
	linkFigure(db, L, F, 'u1');
});

const added = (userId: string) =>
	db
		.select({ lessonId: lessonAdds.lessonId })
		.from(lessonAdds)
		.where(eq(lessonAdds.userId, userId))
		.all()
		.map((r) => r.lessonId);

/** A person's live entries, as what they practise (no ids, no owner). */
const practice = (userId: string) =>
	db
		.select()
		.from(exercises)
		.where(eq(exercises.userId, userId))
		.all()
		.filter((e) => e.archivedAt === null)
		.map((e) => ({
			name: e.name,
			source: e.source,
			lessonId: e.lessonId,
			routineId: e.routineId,
			figureId: e.figureId,
			drillId: e.drillId,
			practiceMode: e.practiceMode,
			countBpm: e.countBpm,
			songId: e.songId,
			dance: e.dance
		}))
		.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name));

const publish = () => expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);

describe('autoAddOnPublish', () => {
	it('publish adds for follow and own members, not all', () => {
		publish();
		for (const u of ['u2', 'u3']) expect(added(u), u).toEqual([L]);
		for (const u of ['u1', 'u4', 'u6']) expect(added(u), u).toEqual([]);
		expect(entryFor(db, 'u2', { lessonId: L })).not.toBeNull();
		expect(entryFor(db, 'u2', { routineId: R })).not.toBeNull();
		expect(entryFor(db, 'u2', { drillId: D })).not.toBeNull();
		// Figures are opt-in from Moves: never ticked by default.
		expect(entryFor(db, 'u2', { figureId: F })).toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});

	it('publish adds nothing for an Everything member with no toggle', () => {
		publish();
		expect(added('u4')).toEqual([]);
		expect(practice('u4')).toEqual([]);
		// Not chosen yet reads as Everything: off unless toggled.
		expect(added('u7')).toEqual([]);
		// The teacher who published, at Everything, too.
		expect(added('u1')).toEqual([]);
	});

	it('follows the toggle: Everything with it on is added, Practise with it off is not', () => {
		publish();
		expect(added('u5')).toEqual([L]);
		expect(added('u6')).toEqual([]);
	});

	it('follow ignores a stored 0', () => {
		db.update(teamMembers).set({ autoAdd: 0 }).where(eq(teamMembers.userId, 'u2')).run();
		publish();
		expect(added('u2')).toEqual([L]);
	});

	it('the added entries equal what Add with default picks makes', () => {
		publish();
		// u4 adds by hand, ticking nothing off.
		const offer = addOffer(db, 'u4', L)!;
		expect(addLesson(db, 'u4', L, defaultPicks(offer), T)).toBe(true);
		expect(practice('u2')).toHaveLength(3);
		expect(practice('u2')).toEqual(practice('u4'));
		const row = (u: string) =>
			db
				.select({ addedAt: lessonAdds.addedAt, seenAt: lessonAdds.seenAt })
				.from(lessonAdds)
				.where(and(eq(lessonAdds.userId, u), eq(lessonAdds.lessonId, L)))
				.get();
		expect(row('u2')).toEqual(row('u4'));
	});

	it('nothing for a draft', () => {
		expect(autoAddOnPublish(db, L, T)).toEqual([]);
		expect(added('u2')).toEqual([]);
	});
});

describe('autoAddOnJoin', () => {
	let older: number;

	beforeEach(() => {
		publish();
		older = L;
		L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-10', title: 'Next', notes: null }).lesson
			.id;
		linkExercise(db, L, D, 'u1');
		publish();
		person('u8');
		setLevel(db, 'u8', 'follow');
	});

	it('join adds the newest only', () => {
		expect(joinClass(db, 'u8', 1, T)).toBe('joined');
		expect(added('u8')).toEqual([L]);
		expect(entryFor(db, 'u8', { lessonId: older })).toBeNull();
		expect(entryFor(db, 'u8', { drillId: D })).not.toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});

	it('the newest by its day, not by when it was made', () => {
		const earlier = createLesson(db, T1_SALSA, {
			lessonDay: '2026-10-27',
			title: 'Catch-up',
			notes: null
		}).lesson.id;
		expect(publishLesson(db, T1_SALSA, earlier, T)).toBe(true);
		joinClass(db, 'u8', 1, T);
		expect(added('u8')).toEqual([L]);
	});

	it('join twice adds once', () => {
		expect(joinClass(db, 'u8', 1, T)).toBe('joined');
		const entries = practice('u8');
		// Removed in between: joining again (already a member) does not bring it back.
		expect(removeLesson(db, 'u8', L, T + 1)).toBe(true);
		expect(joinClass(db, 'u8', 1, T + 2)).toBe('already');
		expect(added('u8')).toEqual([]);
		expect(practice('u8')).toEqual([]);
		expect(entries).toHaveLength(2);
	});

	it('autoAddOnJoin itself adds once', () => {
		joinClass(db, 'u8', 1, T);
		expect(autoAddOnJoin(db, 'u8', 1, T)).toBeNull();
		expect(db.select().from(exercises).where(eq(exercises.userId, 'u8')).all()).toHaveLength(2);
	});

	it('nothing when auto-add is off for the person, or the class has no lesson', () => {
		person('u9');
		setLevel(db, 'u9', 'all');
		joinClass(db, 'u9', 1, T);
		expect(added('u9')).toEqual([]);
		createTeam(db, 'u1', 'salsa', 'Empty class', T);
		expect(joinClass(db, 'u8', 2, T)).toBe('joined');
		expect(autoAddOnJoin(db, 'u8', 2, T)).toBeNull();
	});

	it('nothing for someone not in the class', () => {
		expect(autoAddOnJoin(db, 'u8', 1, T)).toBeNull();
		expect(added('u8')).toEqual([]);
	});
});

describe('auto-add skips a lesson already added or removed', () => {
	it('already added: publish and join add nothing twice', () => {
		publish();
		const before = practice('u2');
		expect(autoAddOnPublish(db, L, T + 5)).toEqual([]);
		expect(autoAddOnJoin(db, 'u2', 1, T + 5)).toBeNull();
		expect(practice('u2')).toEqual(before);
		expect(db.select().from(lessonAdds).where(eq(lessonAdds.userId, 'u2')).all()).toMatchObject([
			{ lessonId: L, addedAt: T }
		]);
	});

	// Publish runs once per lesson (no unpublish; Restore does not publish again),
	// so after it only a growth or a join could bring a removed lesson back.
	it('removed: neither a growth nor publishing again brings it back', () => {
		publish();
		expect(removeLesson(db, 'u3', L, T + 1)).toBe(true);
		expect(publishLesson(db, T1_SALSA, L, T + 2)).toBe(false);
		const D2 = createCustomExercise(db, T1_SALSA, {
			name: 'Footwork',
			everyDays: 3,
			notes: null
		}).id;
		expect(linkExercise(db, L, D2, 'u1')).toBe(true);
		expect(added('u3')).toEqual([]);
		expect(practice('u3')).toEqual([]);
		// The follow member, who kept it, gets the new drill.
		expect(entryFor(db, 'u2', { drillId: D2 })).not.toBeNull();
	});
});

describe('autoAddPending', () => {
	beforeEach(() => {
		publish();
		// u4 (Everything, no toggle) added the lesson by hand.
		expect(addLesson(db, 'u4', L, defaultPicks(addOffer(db, 'u4', L)!), T)).toBe(true);
	});

	it('adds a drill linked after publish for a follow member, not for an all member without the toggle', () => {
		const D2 = db
			.insert(exercises)
			.values({ name: 'Footwork', source: 'custom', dance: 'salsa', teamId: 1 })
			.returning()
			.get().id;
		// Straight into the table: only autoAddPending runs, not a mutation's own call.
		db.insert(lessonExercises)
			.values({ lessonId: L, exerciseId: D2, createdAt: T + 10 })
			.run();
		autoAddPending(db, 1, [L], T + 20);
		expect(entryFor(db, 'u2', { drillId: D2 })).toMatchObject({ archivedAt: null });
		expect(entryFor(db, 'u4', { drillId: D2 })).toBeNull();
		// Added as Add on one pick: what the person saw stays as it was.
		expect(
			db
				.select({ seenAt: lessonAdds.seenAt })
				.from(lessonAdds)
				.where(and(eq(lessonAdds.userId, 'u2'), eq(lessonAdds.lessonId, L)))
				.get()
		).toEqual({ seenAt: T });
		// Run twice: still one entry.
		autoAddPending(db, 1, [L], T + 30);
		expect(
			db
				.select()
				.from(exercises)
				.where(and(eq(exercises.userId, 'u2'), eq(exercises.drillId, D2)))
				.all()
		).toHaveLength(1);
		expect(crossRefs(db)).toEqual([]);
	});

	it('leaves alone what came in before the person last saw the lesson', () => {
		const D2 = createCustomExercise(db, T1_SALSA, {
			name: 'Footwork',
			everyDays: 3,
			notes: null
		}).id;
		db.insert(lessonExercises)
			.values({ lessonId: L, exerciseId: D2, createdAt: T - 1 })
			.run();
		autoAddPending(db, 1, [L], T + 20);
		expect(entryFor(db, 'u2', { drillId: D2 })).toBeNull();
	});

	it('only touches the lessons it is given', () => {
		const D2 = newDrill();
		db.insert(lessonExercises)
			.values({ lessonId: L, exerciseId: D2, createdAt: T + 10 })
			.run();
		autoAddPending(db, 1, [], T + 20);
		autoAddPending(db, 1, [L + 100], T + 20);
		expect(entryFor(db, 'u2', { drillId: D2 })).toBeNull();
	});

	// The spec: turning the toggle on "applies from the next publish on". Growth in
	// lesson B must not bring lesson A's backlog with it.
	it('turning the toggle on, then growth in lesson B, does not add lesson A’s backlog', () => {
		const A = L;
		// u6 (Practise, toggle off) adds A by hand; then A gains X, which waits as "1 new".
		expect(addLesson(db, 'u6', A, defaultPicks(addOffer(db, 'u6', A)!), T)).toBe(true);
		const X = newDrill('X');
		expect(linkExercise(db, A, X, 'u1')).toBe(true);
		expect(entryFor(db, 'u6', { drillId: X })).toBeNull();
		// Lesson B, published while the toggle was off, added by hand too.
		const B = createLesson(db, T1_SALSA, { lessonDay: '2026-11-10', title: 'B', notes: null })
			.lesson.id;
		expect(publishLesson(db, T1_SALSA, B, T)).toBe(true);
		expect(addLesson(db, 'u6', B, defaultPicks(addOffer(db, 'u6', B)!), T)).toBe(true);
		// The toggle goes on; then B gains Y.
		setAutoAdd(db, 'u6', 1, true);
		const Y = newDrill('Y');
		expect(linkExercise(db, B, Y, 'u1')).toBe(true);
		expect(entryFor(db, 'u6', { drillId: Y })).toMatchObject({ archivedAt: null });
		expect(entryFor(db, 'u6', { drillId: X })).toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});
});

/**
 * Every group mutation that can grow a published lesson's reach, and so must
 * call `autoAddPending` in its transaction. A NEW SUCH MUTATION MUST BE ADDED
 * HERE (like `MUTATIONS` in `changes.spec.ts`): each entry gives the class
 * lesson L a new routine or drill, and the follow member must find it on
 * their Today.
 *
 * Not here, on purpose: linking a variation (`linkFigure`, a section linked
 * to a variation) and a routine's slots and embeds. Auto-add, as Add, puts a
 * lesson's routines and drills on Today, never its figures, and what a
 * routine embeds is not something the lesson holds (`newInLesson`), so those
 * never give a member anything new to add.
 */
export const GROWTH: readonly string[] = [
	'linkRoutine',
	'linkExercise',
	'linkInSpace',
	'createAndLinkIn',
	'syncFrom',
	'restoreTrash'
];

type Grown = { routineId: number } | { drillId: number };

const section = () => {
	const video = addLessonVideo(
		db,
		{ lessonId: L, file: 'v.mp4', mime: 'video/mp4', sizeBytes: 9 },
		'u1'
	).id;
	return addSpot(db, { lessonVideoId: video }, { startMs: 0, endMs: 900, label: 'Turn' }, 'u1')!.id;
};

const newDrill = (name = 'Footwork') =>
	createCustomExercise(db, T1_SALSA, { name, everyDays: 3, notes: null }).id;

const RUNS: Record<string, () => Promise<Grown> | Grown> = {
	linkRoutine: () => {
		const R2 = createRoutine(db, T1_SALSA, { name: 'Shines', notes: null }).routine.id;
		expect(linkRoutine(db, L, R2, 'u1')).toBe(true);
		return { routineId: R2 };
	},
	linkExercise: () => {
		const D2 = newDrill();
		expect(linkExercise(db, L, D2, 'u1')).toBe(true);
		return { drillId: D2 };
	},
	linkInSpace: () => {
		const spot = section();
		const D2 = newDrill();
		linkInSpace(db, T1_SALSA, spot, { exerciseId: D2 });
		return { drillId: D2 };
	},
	createAndLinkIn: () => {
		const spot = section();
		createAndLinkIn(db, T1_SALSA, spot, { kind: 'drill', name: 'Footwork' });
		const made = db
			.select({ id: exercises.id })
			.from(exercises)
			.where(and(eq(exercises.teamId, 1), eq(exercises.name, 'Footwork')))
			.get()!;
		return { drillId: made.id };
	},
	// A drill's section link taken out and put back from Recently deleted. The link is
	// inserted straight (no auto-add ran), so the restore is what grows the lesson.
	restoreTrash: () => {
		const spot = section();
		const D2 = newDrill();
		const link = db.insert(spotLinks).values({ spotId: spot, exerciseId: D2 }).returning().get();
		expect(unlinkSpot(db, link.id, { exerciseId: D2 }, Date.now(), 'u1')).toBe(true);
		const trash = db.select().from(teamTrash).get()!;
		expect(restoreTrash(db, T1_SALSA, trash.id, Date.now())).toEqual({ ok: true });
		return { drillId: D2 };
	},
	// Take into the class lesson from the teacher's own copy, which links a
	// copy of the class's drill D2: the class lesson gains D2 itself.
	syncFrom: async () => {
		const D2 = newDrill();
		const mineLesson = await cloneInto(
			db,
			{ kind: 'lesson', id: L, into: U1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		const mineDrill = await cloneInto(
			db,
			{ kind: 'drill', id: D2, into: U1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!mineLesson.ok || !mineDrill.ok) throw new Error('copy refused');
		expect(linkExercise(db, mineLesson.id, mineDrill.id, 'u1')).toBe(true);
		const c = compareWith(db, 'u1', 'lesson', L, mineLesson.id)!;
		const picks = Object.fromEntries(c.diffs.map((d) => [d.key, 'theirs' as const]));
		const r = await takeTheirs(
			db,
			'u1',
			'lesson',
			L,
			mineLesson.id,
			picks,
			c.seen,
			NO_FILES,
			Date.now(),
			1e12
		);
		expect(r).toEqual({ ok: true });
		return { drillId: D2 };
	}
};

describe('every growth mutation adds what is new for a follow member', () => {
	beforeEach(() => {
		publish();
		expect(addLesson(db, 'u4', L, defaultPicks(addOffer(db, 'u4', L)!), T)).toBe(true);
	});

	it('has a run for each entry', () => {
		expect(Object.keys(RUNS).sort()).toEqual([...GROWTH].sort());
	});

	it.each(GROWTH.map((name) => [name]))('%s', async (name) => {
		const grown = await RUNS[name]();
		expect(entryFor(db, 'u2', grown), 'follow').toMatchObject({ archivedAt: null });
		expect(entryFor(db, 'u3', grown), 'own').toMatchObject({ archivedAt: null });
		expect(entryFor(db, 'u4', grown), 'all, no toggle').toBeNull();
		expect(crossRefs(db)).toEqual([]);
	});
});

/**
 * What a lesson holds (`heldBy`) comes only from rows in `lesson_routines`,
 * `lesson_exercises` and `spot_links`. Every place that inserts one is
 * counted here per file: in a GROWTH function, or on this list with why it
 * cannot grow a published class lesson. A new insert fails this until it is
 * placed (and, if it can grow one, calls `autoAddPending`).
 */
const INSERT_SITES: Record<string, { count: number; why: string }> = {
	'lessons.ts': { count: 2, why: 'linkRoutine, linkExercise (GROWTH)' },
	'spot-links.ts': { count: 1, why: 'linkInSpace (GROWTH)' },
	'clones/apply.ts': { count: 3, why: 'applyInto, only through syncFrom (GROWTH)' },
	'clones/clone.ts': { count: 3, why: 'a brand-new copy: a draft or a person’s own lesson' },
	'clones/move.ts': { count: 3, why: 'restoreLinks: back onto the person’s own lesson' }
};

describe('every insert of what a lesson holds is placed', () => {
	it('matches INSERT_SITES', () => {
		const root = 'src/lib/server';
		const found: Record<string, number> = {};
		for (const file of readdirSync(root, { recursive: true }) as string[]) {
			if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
			const hits = readFileSync(`${root}/${file}`, 'utf8').match(
				/insert\((lessonRoutines|lessonExercises|spotLinks)\)/g
			);
			if (hits) found[file] = hits.length;
		}
		expect(found).toEqual(
			Object.fromEntries(Object.entries(INSERT_SITES).map(([f, s]) => [f, s.count]))
		);
	});
});
