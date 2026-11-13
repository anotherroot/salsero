/**
 * The screenshot rig's class (README "A class"): seeds a db COPY so the pages a
 * class member sees at Follow my class have something on them. Run by
 * `seed.sh`, never on its own: it writes to `SHOTS_SEED_DB`, which seed.sh
 * points at its own copy, and refuses a path under `.data`.
 *
 * Mojca teaches "Salsa za začetnike"; the rig's admin (Marija) and Ana are
 * members. Two published lessons (27 and 31 Oct), each with a drill; the
 * second also has a routine of three figures, a video with a section linked
 * to its drill, a shared song, and Ana's question with Mojca's reply. Marija
 * logged the first drill twice. She also has a lesson and a routine of her own
 * (pages.txt asks for them) and there is a second group she is not in. The
 * admin's own exercises are archived, so
 * Today is the class's. Words people write are Slovenian: they are never
 * translated, in either language's shots.
 */
import { expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { openDb } from '../../src/lib/server/db';
import { exercises, figures, users } from '../../src/lib/server/db/schema';
import { splitAccounts } from '../../src/lib/server/dance-split';
import { movePositionsToOwners } from '../../src/lib/server/positions-move';
import { createTeam, joinTeam } from '../../src/lib/server/teams';
import { joinClass } from '../../src/lib/server/auto-add';
import { setLevel } from '../../src/lib/server/levels';
import { createFigure } from '../../src/lib/server/figures';
import {
	createRoutineFromFigures,
	makeSection,
	routineSlots,
	setSlotEnd
} from '../../src/lib/server/routines';
import { listPositions } from '../../src/lib/server/positions';
import { figurePositions, setFigureShape } from '../../src/lib/server/graph';
import { createCustomExercise, logSet } from '../../src/lib/server/exercises';
import {
	addLessonVideo,
	createLesson,
	linkExercise,
	linkRoutine,
	publishLesson
} from '../../src/lib/server/lessons';
import { addSpot } from '../../src/lib/server/spots';
import { linkInSpace } from '../../src/lib/server/spot-links';
import { createSongFromUpload, storeAnalysis } from '../../src/lib/server/songs';
import { shareSong } from '../../src/lib/server/song-share';
import { addMusic } from '../../src/lib/server/song-links';
import { postComment, toggleHeart } from '../../src/lib/server/comments';
import { entryFor } from '../../src/lib/server/entries';
import type { TeamSpace } from '../../src/lib/server/scope';

const path = process.env.SHOTS_SEED_DB ?? '';
const day = (iso: string) => Date.parse(iso);

it('seeds the class into the copy', async () => {
	expect(path).not.toBe('');
	expect(path.split('/')).not.toContain('.data');
	const db = openDb(path);
	const now = day('2026-10-20T10:00:00Z');
	// what boot does first: every account in one dance, the shared positions owned
	await splitAccounts(db, { link: async (_k, f) => f, unlink: async () => {} }, now);
	movePositionsToOwners(db, now);

	const admin = db.select().from(users).orderBy(users.createdAt).all();
	const me = admin.find((u) => u.isAdmin) ?? admin[0];
	expect(me).toBeDefined();
	db.update(users).set({ firstName: 'Marija', lastName: null }).where(eq(users.id, me.id)).run();
	// for pages.txt: a lesson and a routine of her own (their exercises archived with the rest, below)
	const wall = { userId: me.id, dance: 'salsa' as const };
	createLesson(db, wall, { lessonDay: '2026-11-01', title: 'Moje beležke', notes: null });
	const mine = db
		.select({ id: figures.id })
		.from(figures)
		.where(and(eq(figures.userId, me.id), isNull(figures.archivedAt)))
		.orderBy(figures.id)
		.limit(2)
		.all()
		.map((f) => f.id);
	if (mine.length) createRoutineFromFigures(db, wall, { name: 'Doma', notes: null }, mine);
	// for the routine-lift scenes (ext_routine_lift.py): a longer one, after Doma so {routine} stays Doma
	const six = db
		.select({ id: figures.id })
		.from(figures)
		.where(and(eq(figures.userId, me.id), isNull(figures.archivedAt)))
		.orderBy(figures.id)
		.limit(6)
		.all()
		.map((f) => f.id);
	if (six.length === 6) {
		const dolga = createRoutineFromFigures(db, wall, { name: 'Dolga', notes: null }, six);
		// A routine nested three deep for the section scenes (spec 2026-11-12): slots 2–5 a
		// section, and inside it slots 2–3 another.
		const nest = createRoutineFromFigures(db, wall, { name: 'Gnezdo', notes: null }, six);
		if (nest) {
			const ids = routineSlots(db, nest.routine.id).map((s) => s.id);
			const outer = makeSection(db, nest.routine.id, ids.slice(1, 5))!;
			const inner = routineSlots(db, outer.sectionId).map((s) => s.id);
			makeSection(db, outer.sectionId, inner.slice(1, 3));
		}
		// for the slot-end scenes (ext_slot_end.py): slot 2's and 4's figures end in two holds,
		// slot 2 chosen, slot 4 not yet
		const [p1, p2] = listPositions(db, wall);
		if (dolga && p1 && p2) {
			for (const f of [six[1], six[3]]) {
				const { startIds, endIds } = figurePositions(db, f);
				const ends = [...new Set([...endIds, p1.id, p2.id])];
				const timing = db.select().from(figures).where(eq(figures.id, f)).get()!;
				setFigureShape(db, f, {
					startIds,
					endIds: ends,
					startCount: timing.startCount ?? 1,
					lengthCounts: timing.lengthCounts ?? 8
				});
			}
			const steps = routineSlots(db, dolga.routine.id);
			setSlotEnd(db, steps[1].id, p2.id);
		}
	}
	db.update(exercises).set({ archivedAt: now }).where(eq(exercises.userId, me.id)).run();
	setLevel(db, me.id, 'follow');

	const person = (id: string, firstName: string) =>
		db
			.insert(users)
			.values({
				id,
				email: `${id}@shots.local`,
				passwordHash: 'x',
				firstName,
				dance: 'salsa',
				level: id === 'shots-mojca' ? 'all' : 'follow',
				createdAt: now
			})
			.run();
	person('shots-mojca', 'Mojca');
	person('shots-ana', 'Ana');

	const made = createTeam(db, 'shots-mojca', 'salsa', 'Salsa za začetnike', now);
	if (!made.ok) throw new Error(`no group: ${made.reason}`);
	const teamId = made.teamId;
	expect(joinClass(db, me.id, teamId, now + 1000)).toBe('joined');
	expect(joinTeam(db, 'shots-ana', teamId, now + 2000)).toBe('joined');
	const T: TeamSpace = { dance: 'salsa', teamId, actorId: 'shots-mojca' };

	// the first lesson: one drill
	const basic = createCustomExercise(db, T, {
		name: 'Osnovni korak na mestu',
		everyDays: 3,
		notes: 'Štejte na glas: ena, dva, tri … pet, šest, sedem.'
	}).id;
	const first = createLesson(db, T, {
		lessonDay: '2026-10-27',
		title: 'Prva lekcija',
		notes: 'Osnovni korak naprej in nazaj, drža rok.'
	}).lesson.id;
	linkExercise(db, first, basic, 'shots-mojca');
	publishLesson(db, T, first, day('2026-10-27T19:00:00Z'));

	// the second: a drill, a routine, a video with a section, a song, comments
	const turn = createCustomExercise(db, T, {
		name: 'Obrat v desno',
		everyDays: 3,
		notes: null
	}).id;
	const figure = (figureName: string) =>
		createFigure(db, T, {
			figureName,
			name: 'Osnovna',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
	const routine = createRoutineFromFigures(db, T, { name: 'Prva kombinacija', notes: null }, [
		figure('Dile que no'),
		figure('Enchufla'),
		figure('Vacilala')
	])!.routine.id;
	const second = createLesson(db, T, {
		lessonDay: '2026-10-31',
		title: 'Druga lekcija',
		notes: 'Ponovili smo osnovni korak in se naučili prvi obrat. Doma vadite počasi.'
	}).lesson.id;
	linkExercise(db, second, turn, 'shots-mojca');
	linkRoutine(db, second, routine, 'shots-mojca');
	const video = process.env.SHOTS_SEED_VIDEO;
	if (video) {
		const v = addLessonVideo(
			db,
			{
				lessonId: second,
				file: video,
				mime: 'video/webm',
				sizeBytes: Number(process.env.SHOTS_SEED_VIDEO_BYTES ?? 1)
			},
			'shots-mojca'
		);
		const spot = addSpot(
			db,
			{ lessonVideoId: v.id },
			{ startMs: 1000, endMs: 4000, label: 'Obrat' },
			'shots-mojca'
		)!;
		linkInSpace(db, T, spot.id, { exerciseId: turn });
	}
	const audio = process.env.SHOTS_SEED_AUDIO;
	if (audio) {
		const song = createSongFromUpload(
			db,
			T,
			{ file: audio, mime: 'audio/wav', title: 'Chan Chan', style: 'salsa', sizeBytes: 1000 },
			now
		).id;
		storeAnalysis(db, song, {
			beats: Array.from({ length: 160 }, (_, i) => 0.5 + i * 0.5),
			downbeats: [0.5],
			durationS: 90
		});
		shareSong(db, T, song, now);
		addMusic(db, T, { lessonId: second }, song, 'Za ogrevanje, počasi.', now);
		addMusic(db, T, { exerciseId: basic }, song, null, now);
	}
	publishLesson(db, T, second, day('2026-10-31T19:00:00Z'));

	// Marija practised the first drill twice; Ana asked, Mojca answered
	const entry = entryFor(db, me.id, { drillId: basic });
	expect(entry).not.toBeNull();
	for (const [at, rating] of [
		['2026-10-29T17:00:00Z', 2],
		['2026-11-02T17:00:00Z', 4]
	] as const)
		logSet(db, {
			exerciseId: entry!.id,
			doneAt: day(at),
			durationS: 600,
			reps: null,
			rating,
			note: null,
			playerJson: null
		});
	const asked = postComment(
		db,
		'shots-ana',
		second,
		'Ali se obrat začne na ena ali na pet?',
		null,
		day('2026-11-04T08:00:00Z')
	);
	if ('refused' in asked) throw new Error(`no comment: ${asked.refused}`);
	const answer = postComment(
		db,
		'shots-mojca',
		second,
		'Na ena. V torek ga ponovimo.',
		asked.id,
		day('2026-11-04T09:30:00Z')
	);
	if ('refused' in answer) throw new Error(`no reply: ${answer.refused}`);
	toggleHeart(db, 'shots-ana', answer.id, day('2026-11-04T10:00:00Z'));

	// a group she is not in ({joincode})
	createTeam(db, 'shots-mojca', 'salsa', 'Salsa nadaljevalni', now);

	// The rig's clock stands at instant.txt (5 Nov): what the functions stamped with the
	// real clock is moved back to the second lesson, so the class's entries are due.
	const before = day('2026-10-31T19:00:00Z');
	const raw = db.$client;
	const tables = raw
		// never drizzle's own table: its created_at says which migrations ran
		.prepare(
			"select name from sqlite_master where type = 'table' and name != '__drizzle_migrations'"
		)
		.all() as { name: string }[];
	for (const { name } of tables) {
		const cols = raw.prepare(`pragma table_info("${name}")`).all() as { name: string }[];
		if (cols.some((c) => c.name === 'created_at'))
			raw
				.prepare(`update "${name}" set created_at = ? where created_at > ?`)
				.run(before, day('2026-11-05T00:00:00Z'));
	}
});
