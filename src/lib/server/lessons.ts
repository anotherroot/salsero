import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	notInArray,
	or,
	sum
} from 'drizzle-orm';
import type { Db } from './db';
import { assertUnlinked } from './spot-links';
import { lessonsReaching, viaSections } from './lesson-links';
import { listVersions } from './figures';
import { listPickRoutines, listUsableRoutines } from './routines';
import { ownedOrUsable, usableBy, usableDrills, usableOf, usableVersions } from './usable';
import {
	exercises,
	figureGroups,
	figures,
	lessonAdds,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	lessons,
	routines,
	spotLinks,
	videoSpots,
	type Exercise,
	type Lesson
} from './db/schema';
import {
	inSpace,
	isTeam,
	ownedBy,
	ownerValues,
	type Space,
	type TeamSpace,
	type Wall
} from './scope';
import { getTeam, roleOf } from './teams';
import { entryFor, entryJoin, reconcileEntries, reviveEntries, type EntryTarget } from './entries';
import { actingIn, fieldChange, logChange } from './changes';
import { rootTitle, trashRows, type ArchiveRestore } from './trash';
import type {
	LessonExerciseRow,
	LessonFigureRow,
	LessonItem,
	LessonRoutineRow,
	LessonVideoRow,
	FigureVersion,
	PickExercise,
	PickRoutine,
	Role,
	TeamLessonItem
} from '$lib/types';

export interface LessonInput {
	/** The local day the class happened, `YYYY-MM-DD`. */
	lessonDay: string;
	title: string;
	notes: string | null;
}

export interface LessonVideoInput {
	lessonId: number;
	file: string;
	mime: string;
	sizeBytes: number;
}

/**
 * What the lesson's own exercise is called on Today. Prefixed so a lesson and
 * the figures it taught never read as the same kind of thing in the list.
 */
export function reviewName(title: string): string {
	return `Review: ${title}`;
}

/**
 * A lesson's space, for comparing a linked row with it, acted in by `by` (a
 * write names who, for History; a read leaves it out). Null for a missing
 * lesson.
 */
function lessonSpace(db: Db, lessonId: number, by?: string): Space | null {
	const lesson = db
		.select({ dance: lessons.dance, userId: lessons.userId, teamId: lessons.teamId })
		.from(lessons)
		.where(eq(lessons.id, lessonId))
		.get();
	return lesson ? actingIn(lesson, by) : null;
}

/** What a lesson links by hand: a variation, a routine or an exercise (a drill, in a group). */
type Linked = { figureId: number } | { routineId: number } | { exerciseId: number };

/** The name History shows for a linked thing ("Enchufla · Doble"); null when it is gone. */
function linkedName(tx: Db, t: Linked): string | null {
	if ('figureId' in t) {
		const row = tx
			.select({ figure: figureGroups.name, name: figures.name })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(figures.id, t.figureId))
			.get();
		return row ? `${row.figure} · ${row.name}` : null;
	}
	if ('routineId' in t) {
		return (
			tx.select({ name: routines.name }).from(routines).where(eq(routines.id, t.routineId)).get()
				?.name ?? null
		);
	}
	return (
		tx.select({ name: exercises.name }).from(exercises).where(eq(exercises.id, t.exerciseId)).get()
			?.name ?? null
	);
}

/** History's line for a thing linked to or taken off a group's lesson. */
function logLinked(
	tx: Db,
	space: Space,
	lessonId: number,
	verb: 'add' | 'remove',
	t: Linked,
	name: string | null,
	now: number
): void {
	const [subject, subjectId] =
		'figureId' in t
			? ['figure', t.figureId]
			: 'routineId' in t
				? ['routine', t.routineId]
				: ['drill', t.exerciseId];
	const named = name === null ? null : { name };
	logChange(
		tx,
		space,
		{
			rootKind: 'lesson',
			rootId: lessonId,
			verb,
			subject,
			subjectId,
			...(verb === 'add' ? { after: named } : { before: named })
		},
		now
	);
}

/** `logLinked` for an unlink, which reads the lesson's space itself. */
function logUnlinked(
	tx: Db,
	lessonId: number,
	t: Linked,
	name: string | null,
	by: string | undefined,
	now: number
): void {
	const space = lessonSpace(tx, lessonId, by);
	if (space) logLinked(tx, space, lessonId, 'remove', t, name, now);
}

/**
 * The row whose owner counts for an exercise a lesson links: a drill's own,
 * and an entry's target's (its figure, routine or drill). An entry is its
 * person's row pointing at another row, so its own owner says nothing about
 * where its content lives. Null when the target is gone.
 */
function ownerRowOf(
	db: Db,
	e: Pick<Exercise, 'dance' | 'userId' | 'teamId' | 'figureId' | 'routineId' | 'drillId'>
): { dance: string; userId: string | null; teamId: number | null } | null {
	const cols = (t: typeof figures | typeof routines | typeof exercises) => ({
		dance: t.dance,
		userId: t.userId,
		teamId: t.teamId
	});
	if (e.figureId !== null) {
		return db.select(cols(figures)).from(figures).where(eq(figures.id, e.figureId)).get() ?? null;
	}
	if (e.routineId !== null) {
		return (
			db.select(cols(routines)).from(routines).where(eq(routines.id, e.routineId)).get() ?? null
		);
	}
	if (e.drillId !== null) {
		return (
			db.select(cols(exercises)).from(exercises).where(eq(exercises.id, e.drillId)).get() ?? null
		);
	}
	return e;
}

/**
 * Create a lesson AND its review exercise, in one transaction — the same rule
 * `createFigure` follows. A lesson with nothing on Today is a lesson you never
 * go back to, which is the one thing this feature exists to prevent.
 *
 * A group's lesson gets no exercise: nobody would practise it, and each
 * member's Add makes their own.
 */
export function createLesson(
	db: Db,
	wall: Wall,
	input: LessonInput,
	everyDays?: number
): { lesson: Lesson; exercise: Exercise };
export function createLesson(
	db: Db,
	space: Space,
	input: LessonInput,
	everyDays?: number
): { lesson: Lesson; exercise: Exercise | null };
export function createLesson(
	db: Db,
	space: Space,
	input: LessonInput,
	everyDays = 3
): { lesson: Lesson; exercise: Exercise | null } {
	return db.transaction((tx) => {
		const made = insertLesson(tx, space, input, everyDays);
		logChange(
			tx,
			space,
			{
				...ofLesson(made.lesson.id),
				verb: 'add',
				subject: 'lesson',
				after: { title: made.lesson.title }
			},
			Date.now()
		);
		return made;
	});
}

/**
 * The lesson row and, in a person's space, its review exercise, inside a
 * caller's transaction; logs nothing. `createLesson` is this plus History's
 * line; the clone engine writes its own line.
 */
export function insertLesson(
	tx: Db,
	space: Space,
	input: LessonInput,
	everyDays = 3
): { lesson: Lesson; exercise: Exercise | null } {
	const lesson = tx
		.insert(lessons)
		.values({ ...input, ...ownerValues(space) })
		.returning()
		.get();
	if (isTeam(space)) return { lesson, exercise: null };
	const exercise = tx
		.insert(exercises)
		.values({
			name: reviewName(lesson.title),
			source: 'lesson',
			lessonId: lesson.id,
			dance: space.dance,
			userId: space.userId,
			everyDays
		})
		.returning()
		.get();
	return { lesson, exercise };
}

/** A lesson's root in History, and the lesson as its own subject. */
const ofLesson = (id: number) => ({ rootKind: 'lesson' as const, rootId: id, subjectId: id });

/** The fields a lesson's edit form writes, as History keeps them. */
const lessonFields = (l: LessonInput) => ({
	title: l.title,
	lessonDay: l.lessonDay,
	notes: l.notes
});

/**
 * Edit a lesson. A retitle carries over to its exercise so the two never drift.
 * In a group, `by` is who, for History (`verb` is `restore` for History's own
 * Restore).
 */
export function updateLesson(
	db: Db,
	id: number,
	input: LessonInput,
	by?: string,
	now = Date.now(),
	verb: 'change' | 'restore' = 'change'
) {
	return db.transaction((tx) => {
		const before = getLessonRow(tx, id);
		if (!before) return null;
		const lesson = tx.update(lessons).set(input).where(eq(lessons.id, id)).returning().get()!;
		tx.update(exercises)
			.set({ name: reviewName(lesson.title) })
			.where(eq(exercises.lessonId, id))
			.run();
		const change = fieldChange(lessonFields(before), lessonFields(lesson), 'lesson');
		if (change) logChange(tx, actingIn(lesson, by), { ...ofLesson(id), verb, ...change }, now);
		return lesson;
	});
}

/**
 * After a change that can shrink a group lesson's reach, its members' entries
 * follow in the same transaction (risk 25). Nothing for a person's own lesson.
 */
function reconcileLesson(tx: Db, lessonId: number, now: number): void {
	const teamId =
		tx.select({ teamId: lessons.teamId }).from(lessons).where(eq(lessons.id, lessonId)).get()
			?.teamId ?? null;
	if (teamId !== null) reconcileEntries(tx, teamId, now);
}

/**
 * Archive a lesson and its review exercise together (in a group, every
 * person's entry for it). Videos, links and sets stay.
 */
export function archiveLesson(db: Db, id: number, now: number, by?: string): boolean {
	return db.transaction((tx) => {
		const lesson = tx
			.update(lessons)
			.set({ archivedAt: now })
			.where(and(eq(lessons.id, id), isNull(lessons.archivedAt)))
			.returning()
			.get();
		if (!lesson) return false;
		tx.update(exercises)
			.set({ archivedAt: now })
			.where(and(eq(exercises.lessonId, id), isNull(exercises.archivedAt)))
			.run();
		reconcileLesson(tx, id, now);
		logChange(
			tx,
			actingIn(lesson, by),
			{ ...ofLesson(id), verb: 'archive', subject: 'lesson' },
			now
		);
		return true;
	});
}

/**
 * Bring an archived lesson back (Recently deleted), with exactly the entries
 * its archive took: those archived at the lesson's own `archived_at` (risk 6).
 * One a member had removed earlier carries an earlier time and stays removed.
 */
export function restoreLesson(db: Db, space: Space, id: number, now: number): ArchiveRestore {
	return db.transaction((tx) => {
		const lesson = getLessonRow(tx, id);
		if (!lesson || lesson.archivedAt === null || !inSpace(lesson, space)) {
			return { ok: false, reason: 'gone' } as const;
		}
		const at = lesson.archivedAt;
		tx.update(lessons).set({ archivedAt: null }).where(eq(lessons.id, id)).run();
		tx.update(exercises)
			.set({ archivedAt: null })
			.where(and(eq(exercises.lessonId, id), eq(exercises.archivedAt, at)))
			.run();
		if (isTeam(space)) reviveEntries(tx, space.teamId, at);
		logChange(
			tx,
			space,
			{ ...ofLesson(id), verb: 'restore', subject: 'lesson', after: { title: lesson.title } },
			now
		);
		return { ok: true } as const;
	});
}

/**
 * Publish a group's draft: from now on its members see it. Only a live draft
 * of this group moves, and only for one of its editors (or its owner) while
 * the group lives; there is no unpublish (taking a lesson away is archiving
 * it). False when nothing moved.
 */
export function publishLesson(db: Db, space: TeamSpace, id: number, now: number): boolean {
	const team = getTeam(db, space.teamId);
	if (!team || team.deletedAt !== null || team.dance !== space.dance) return false;
	const role = roleOf(db, space.actorId, space.teamId);
	if (role !== 'editor' && role !== 'owner') return false;
	return db.transaction((tx) => {
		const moved =
			tx
				.update(lessons)
				.set({ publishedAt: now })
				.where(
					and(
						eq(lessons.id, id),
						eq(lessons.teamId, space.teamId),
						isNull(lessons.publishedAt),
						isNull(lessons.archivedAt)
					)
				)
				.run().changes > 0;
		if (moved) logChange(tx, space, { ...ofLesson(id), verb: 'publish', subject: 'lesson' }, now);
		return moved;
	});
}

/**
 * The library: newest class first, with what its videos cost on disk and how
 * much is in it — sections, routines, figures. A person's own lessons, or a
 * group's (every one of them, drafts included: `listTeamLessons` decides who
 * sees which).
 */
export function listLessons(db: Db, space: Space): LessonItem[] {
	const team = isTeam(space) ? getTeam(db, space.teamId) : null;
	const ref = team ? { id: team.id, name: team.name } : null;
	return lessonRows(db, space).map((r) => ({ ...r, team: ref }));
}

/**
 * A group's lessons, as its page lists them. An editor (or the owner, while
 * the group lives) sees the drafts first, then the published ones; a member
 * sees the published ones only. Newest class first within each.
 */
export function listTeamLessons(
	db: Db,
	userId: string,
	teamId: number,
	role: Role
): TeamLessonItem[] {
	const team = getTeam(db, teamId);
	if (!team || team.purgedAt !== null) return [];
	const space: TeamSpace = { dance: team.dance as TeamSpace['dance'], teamId, actorId: userId };
	const editor = role !== 'member' && team.deletedAt === null;
	const rows = lessonRows(db, space)
		.filter((r) => editor || r.publishedAt !== null)
		.map((r) => ({ ...r, team: { id: team.id, name: team.name } }));
	return [...rows.filter((r) => r.publishedAt === null), ...rows.filter((r) => r.publishedAt)];
}

/**
 * The rows behind both lists. Each count is one grouped query over the whole
 * space, keyed by lesson, so the list stays a fixed number of queries however
 * many lessons there are.
 */
function lessonRows(
	db: Db,
	space: Space
): (Omit<LessonItem, 'team'> & { publishedAt: number | null })[] {
	// A person's lessons may link the group rows they may use (ruling 2): those
	// count on the card as they show on the page. A group's count its own only.
	const usable = isTeam(space) ? null : usableOf(db, space);
	const whoseFigures = usable
		? ownedOrUsable(figures, space, usable.figures)
		: ownedBy(figures, space);
	const whoseRoutines = usable
		? ownedOrUsable(routines, space, usable.routines)
		: ownedBy(routines, space);
	const sections = new Map(
		db
			.select({ id: lessonVideos.lessonId, n: count(videoSpots.id) })
			.from(videoSpots)
			.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(and(ownedBy(lessons, space), isNotNull(videoSpots.endMs)))
			.groupBy(lessonVideos.lessonId)
			.all()
			.map((r) => [r.id, r.n])
	);
	const routineCounts = new Map(
		db
			.select({ id: lessonRoutines.lessonId, n: count(routines.id) })
			.from(lessonRoutines)
			.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
			.where(and(whoseRoutines, isNull(routines.archivedAt)))
			.groupBy(lessonRoutines.lessonId)
			.all()
			.map((r) => [r.id, r.n])
	);
	// A figure is its group: two variations of one figure on a lesson count once.
	const hand = db
		.select({ id: lessonFigures.lessonId, group: figures.groupId })
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.where(and(whoseFigures, isNull(figures.archivedAt)))
		.all();
	const viaSection = db
		.select({ id: lessonVideos.lessonId, group: figures.groupId })
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.innerJoin(figures, eq(figures.id, spotLinks.figureId))
		.where(and(whoseFigures, isNull(figures.archivedAt)))
		.all();
	const figureGroupsOf = new Map<number, Set<number | null>>();
	for (const { id, group } of [...hand, ...viaSection]) {
		figureGroupsOf.set(id, (figureGroupsOf.get(id) ?? new Set()).add(group));
	}

	return db
		.select({
			id: lessons.id,
			lessonDay: lessons.lessonDay,
			title: lessons.title,
			videos: count(lessonVideos.id),
			// `sum` is null when a lesson has no videos; the cast keeps the shape honest.
			videoBytes: sum(lessonVideos.sizeBytes),
			createdAt: lessons.createdAt,
			publishedAt: lessons.publishedAt
		})
		.from(lessons)
		.leftJoin(lessonVideos, eq(lessonVideos.lessonId, lessons.id))
		.where(and(isNull(lessons.archivedAt), ownedBy(lessons, space)))
		.groupBy(lessons.id)
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all()
		.map((r) => ({
			...r,
			videoBytes: Number(r.videoBytes ?? 0),
			sections: sections.get(r.id) ?? 0,
			routines: routineCounts.get(r.id) ?? 0,
			figures: figureGroupsOf.get(r.id)?.size ?? 0
		}));
}

/**
 * Each lesson's day, by id, for Today's lesson rows: the person's own lessons
 * and the group lessons they added (an entry can review either; risk 26).
 */
export function lessonDays(db: Db, wall: Wall): Record<number, string> {
	const day = { id: lessons.id, day: lessons.lessonDay };
	const own = db.select(day).from(lessons).where(ownedBy(lessons, wall)).all();
	const added = db
		.select(day)
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.where(and(eq(lessonAdds.userId, wall.userId), eq(lessons.dance, wall.dance)))
		.all();
	return Object.fromEntries([...own, ...added].map((r) => [r.id, r.day]));
}

/**
 * The Lessons tab: the person's own lessons and the group lessons they added
 * (each marked with its group), newest class first. An added lesson stays
 * while it is published and live and its group is not purged, after leaving
 * the group too; a group lesson not added is only on the group's page.
 */
export function listMyLessons(db: Db, wall: Wall): LessonItem[] {
	const added = db
		.select({ lessonId: lessonAdds.lessonId, teamId: lessons.teamId })
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.where(
			and(
				eq(lessonAdds.userId, wall.userId),
				eq(lessons.dance, wall.dance),
				isNotNull(lessons.teamId),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all();
	const byTeam = new Map<number, Set<number>>();
	for (const a of added) {
		byTeam.set(a.teamId!, (byTeam.get(a.teamId!) ?? new Set()).add(a.lessonId));
	}
	const theirs: LessonItem[] = [];
	for (const [teamId, ids] of byTeam) {
		const team = getTeam(db, teamId);
		if (!team || team.purgedAt !== null) continue;
		const space: TeamSpace = { dance: wall.dance, teamId, actorId: wall.userId };
		for (const r of lessonRows(db, space)) {
			if (ids.has(r.id)) theirs.push({ ...r, team: { id: team.id, name: team.name } });
		}
	}
	return [...listLessons(db, wall), ...theirs].sort(
		(a, b) => b.lessonDay.localeCompare(a.lessonDay) || b.id - a.id
	);
}

/**
 * Every byte this person's lesson videos occupy, both dances and archived
 * lessons included — an archived lesson's video is still on the disk, so the
 * readout must say so. Another person's videos are not theirs to see, not even
 * as a number. See `MAX_LESSON_VIDEO_BYTES` in `src/lib/limits.ts`.
 */
export function lessonVideoBytes(db: Db, userId: string): number {
	const row = db
		.select({ total: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(eq(lessons.userId, userId))
		.get();
	return Number(row?.total ?? 0);
}

/** The variation ids on a lesson: linked by hand or through its sections. */
function linkedFigureIds(db: Db, lessonId: number): number[] {
	const hand = db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	return [...new Set([...hand, ...viaSections(db, lessonId).figures.keys()])];
}

/** The routine ids linked to a lesson. */
function linkedRoutineIds(db: Db, lessonId: number): number[] {
	return db
		.select({ id: lessonRoutines.routineId })
		.from(lessonRoutines)
		.where(eq(lessonRoutines.lessonId, lessonId))
		.all()
		.map((r) => r.id);
}

/** The lesson row alone, or null: what a route checks a posted id against. */
export function getLessonRow(db: Db, id: number): Lesson | null {
	return db.select().from(lessons).where(eq(lessons.id, id)).get() ?? null;
}

export function getLesson(db: Db, id: number, userId: string) {
	const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
	if (!lesson) return null;

	const exercise = entryFor(db, userId, { lessonId: id });

	const videos: LessonVideoRow[] = db
		.select({
			id: lessonVideos.id,
			file: lessonVideos.file,
			mime: lessonVideos.mime,
			sizeBytes: lessonVideos.sizeBytes,
			sourceUrl: lessonVideos.sourceUrl,
			createdAt: lessonVideos.createdAt
		})
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, id))
		.orderBy(asc(lessonVideos.createdAt))
		.all();

	// Hand links and section links, merged: a variation linked both ways is one row.
	const via = viaSections(db, id);
	const figureColumns = {
		id: figures.id,
		figure: figureGroups.name,
		variation: figures.name,
		partner: figures.partner,
		style: figures.styleTag,
		exerciseId: exercises.id
	};
	const handFigures = db
		.select(figureColumns)
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.leftJoin(exercises, entryJoin(userId, eq(exercises.figureId, figures.id)))
		.where(eq(lessonFigures.lessonId, id))
		.all();
	const handFigureIds = new Set(handFigures.map((r) => r.id));
	const sectionFigureIds = [...via.figures.keys()].filter((f) => !handFigureIds.has(f));
	const sectionFigures =
		sectionFigureIds.length === 0
			? []
			: db
					.select(figureColumns)
					.from(figures)
					.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
					.leftJoin(exercises, entryJoin(userId, eq(exercises.figureId, figures.id)))
					.where(inArray(figures.id, sectionFigureIds))
					.all();
	const linkedFigures: LessonFigureRow[] = [...handFigures, ...sectionFigures]
		.map(({ figure, variation, ...r }) => ({
			...r,
			name: `${figure} · ${variation}`,
			byHand: handFigureIds.has(r.id),
			viaSections: via.figures.get(r.id) ?? []
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const linkedRoutines: LessonRoutineRow[] = db
		.select({
			id: routines.id,
			name: routines.name,
			exerciseId: exercises.id,
			everyDays: exercises.everyDays
		})
		.from(lessonRoutines)
		.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
		.leftJoin(exercises, entryJoin(userId, eq(exercises.routineId, routines.id)))
		.where(eq(lessonRoutines.lessonId, id))
		.orderBy(asc(routines.name))
		.all();

	const exerciseColumns = {
		id: exercises.id,
		name: exercises.name,
		source: exercises.source,
		everyDays: exercises.everyDays
	};
	const handExercises = db
		.select(exerciseColumns)
		.from(lessonExercises)
		.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
		.where(and(eq(lessonExercises.lessonId, id), isNull(exercises.archivedAt)))
		.all();
	const handExerciseIds = new Set(handExercises.map((r) => r.id));
	const sectionExerciseIds = [...via.exercises.keys()].filter((e) => !handExerciseIds.has(e));
	const sectionExercises =
		sectionExerciseIds.length === 0
			? []
			: db
					.select(exerciseColumns)
					.from(exercises)
					.where(and(inArray(exercises.id, sectionExerciseIds), isNull(exercises.archivedAt)))
					.all();
	const linkedExercises: LessonExerciseRow[] = [...handExercises, ...sectionExercises]
		.map((r) => ({
			...r,
			byHand: handExerciseIds.has(r.id),
			viaSections: via.exercises.get(r.id) ?? []
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	// A linked figure's or routine's exercise belongs under it, never in this
	// list. `linkFigure` and `linkRoutine` already sweep it out on write;
	// filtering here too means a row that slipped in before the link cannot show
	// up twice.
	const ownedByLinked = new Set([
		...linkedFigures.map((f) => f.exerciseId),
		...linkedRoutines.map((r) => r.exerciseId)
	]);

	return {
		lesson,
		exercise,
		videos,
		figures: linkedFigures,
		routines: linkedRoutines,
		exercises: linkedExercises.filter((e) => !ownedByLinked.has(e.id))
	};
}

/**
 * Link a figure, and drop its exercise from the hand-linked list in the same
 * transaction — a figure's exercise is shown under the figure, and showing it
 * in both places is the thing this feature was asked not to do.
 */
export function linkFigure(db: Db, lessonId: number, figureId: number, by?: string): boolean {
	return db.transaction((tx) => {
		const figure = tx
			.select({
				id: figures.id,
				dance: figures.dance,
				userId: figures.userId,
				teamId: figures.teamId
			})
			.from(figures)
			.where(and(eq(figures.id, figureId), isNull(figures.archivedAt)))
			.get();
		if (!figure) return false;

		// A lesson and a figure from different spaces (dances, people or groups) must
		// never join: the wall is the point, and no CHECK can express it (see `schema.ts`).
		// The one crossing: a person's own lesson may link a group's variation they
		// may use (`usableBy`, ruling 2), without a copy. A group's lesson, never another's.
		const space = lessonSpace(tx, lessonId, by);
		if (!space || !(inSpace(figure, space) || usableBy(tx, space, 'figures', figure))) {
			return false;
		}

		const res = tx.insert(lessonFigures).values({ lessonId, figureId }).onConflictDoNothing().run();
		if (res.changes === 0) return false;

		const owned = ownEntryIds(tx, space, { figureId });
		if (owned.length > 0) {
			tx.delete(lessonExercises)
				.where(
					and(eq(lessonExercises.lessonId, lessonId), inArray(lessonExercises.exerciseId, owned))
				)
				.run();
		}
		logLinked(tx, space, lessonId, 'add', { figureId }, linkedName(tx, { figureId }), Date.now());
		return true;
	});
}

/**
 * Take a variation off a lesson. With `alsoSections`, the links from this
 * lesson's videos' sections to it go too, in the same transaction — otherwise
 * a variation there through a section would stay on the lesson. In a group,
 * members' entries the lesson no longer holds go off Today (`reconcileEntries`).
 */
export function unlinkFigure(
	db: Db,
	lessonId: number,
	figureId: number,
	alsoSections = false,
	now = Date.now(),
	by?: string
): boolean {
	return db.transaction((tx) => {
		const name = linkedName(tx, { figureId });
		let changes = tx
			.delete(lessonFigures)
			.where(and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, figureId)))
			.run().changes;
		if (alsoSections) {
			const spots = (viaSections(tx, lessonId).figures.get(figureId) ?? []).map((s) => s.spotId);
			if (spots.length > 0) {
				changes += tx
					.delete(spotLinks)
					.where(and(eq(spotLinks.figureId, figureId), inArray(spotLinks.spotId, spots)))
					.run().changes;
			}
		}
		if (changes > 0) reconcileLesson(tx, lessonId, now);
		if (changes > 0) logUnlinked(tx, lessonId, { figureId }, name, by, now);
		return changes > 0;
	});
}

/**
 * Link a routine — `linkFigure`'s twin. A routine owns its exercise the way a
 * figure does, so linking one sweeps that exercise out of the hand-linked list
 * in the same transaction.
 */
export function linkRoutine(db: Db, lessonId: number, routineId: number, by?: string): boolean {
	return db.transaction((tx) => {
		const routine = tx
			.select({
				id: routines.id,
				dance: routines.dance,
				userId: routines.userId,
				teamId: routines.teamId
			})
			.from(routines)
			.where(and(eq(routines.id, routineId), isNull(routines.archivedAt)))
			.get();
		if (!routine) return false;

		// The space, as in `linkFigure`: the route checks the lesson's space, and
		// this is the only check on the routine id posted with it. A person's own
		// lesson may link a group's routine they may use.
		const space = lessonSpace(tx, lessonId, by);
		if (!space || !(inSpace(routine, space) || usableBy(tx, space, 'routines', routine))) {
			return false;
		}

		const res = tx
			.insert(lessonRoutines)
			.values({ lessonId, routineId })
			.onConflictDoNothing()
			.run();
		if (res.changes === 0) return false;

		const owned = ownEntryIds(tx, space, { routineId });
		if (owned.length > 0) {
			tx.delete(lessonExercises)
				.where(
					and(eq(lessonExercises.lessonId, lessonId), inArray(lessonExercises.exerciseId, owned))
				)
				.run();
		}
		logLinked(tx, space, lessonId, 'add', { routineId }, linkedName(tx, { routineId }), Date.now());
		return true;
	});
}

/** Take a routine off a lesson; in a group, the entries `unlinkFigure` says go with it. */
export function unlinkRoutine(
	db: Db,
	lessonId: number,
	routineId: number,
	now = Date.now(),
	by?: string
): boolean {
	return db.transaction((tx) => {
		const name = linkedName(tx, { routineId });
		const gone =
			tx
				.delete(lessonRoutines)
				.where(and(eq(lessonRoutines.lessonId, lessonId), eq(lessonRoutines.routineId, routineId)))
				.run().changes > 0;
		if (gone) reconcileLesson(tx, lessonId, now);
		if (gone) logUnlinked(tx, lessonId, { routineId }, name, by, now);
		return gone;
	});
}

/**
 * Attach an existing exercise by hand. Refuses one owned by a figure or routine
 * this lesson already links — the other half of the "never in both places" rule.
 */
export function linkExercise(db: Db, lessonId: number, exerciseId: number, by?: string): boolean {
	return db.transaction((tx) => {
		const exercise = tx
			.select({
				id: exercises.id,
				dance: exercises.dance,
				userId: exercises.userId,
				teamId: exercises.teamId,
				figureId: exercises.figureId,
				routineId: exercises.routineId,
				drillId: exercises.drillId,
				lessonId: exercises.lessonId,
				source: exercises.source
			})
			.from(exercises)
			.where(and(eq(exercises.id, exerciseId), isNull(exercises.archivedAt)))
			.get();
		if (!exercise) return false;
		// A review exercise belongs to the lesson that created it, this one
		// included; it is never something a lesson "links".
		if (exercise.lessonId !== null) return false;

		// A lesson and an exercise from different spaces must never join: the wall
		// is the point, and no CHECK can express it (see `schema.ts`). For an entry
		// its target counts too: a person's entry for a group's figure is theirs,
		// but what it shows is the group's, and never belongs on their own lesson.
		// A person's own lesson may link the group's drill itself, when they may
		// use it (`usableBy`, ruling 2).
		const space = lessonSpace(tx, lessonId, by);
		if (!space) return false;
		if (!inSpace(exercise, space)) {
			if (exercise.source !== 'custom' || !usableBy(tx, space, 'drills', exercise)) return false;
		} else {
			const owner = ownerRowOf(tx, exercise);
			if (!owner || !inSpace(owner, space)) return false;
		}

		if (exercise.figureId !== null) {
			const linked = tx
				.select({ figureId: lessonFigures.figureId })
				.from(lessonFigures)
				.where(
					and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, exercise.figureId))
				)
				.get();
			if (linked) return false;
			// On the lesson through a section counts too: never in both places.
			if (viaSections(tx, lessonId).figures.has(exercise.figureId)) return false;
		}
		if (exercise.routineId !== null) {
			const linked = tx
				.select({ routineId: lessonRoutines.routineId })
				.from(lessonRoutines)
				.where(
					and(
						eq(lessonRoutines.lessonId, lessonId),
						eq(lessonRoutines.routineId, exercise.routineId)
					)
				)
				.get();
			if (linked) return false;
		}
		const added =
			tx.insert(lessonExercises).values({ lessonId, exerciseId }).onConflictDoNothing().run()
				.changes > 0;
		if (added) {
			const name = linkedName(tx, { exerciseId });
			logLinked(tx, space, lessonId, 'add', { exerciseId }, name, Date.now());
		}
		return added;
	});
}

/** `unlinkFigure`, for a drill or any hand-linked exercise. */
export function unlinkExercise(
	db: Db,
	lessonId: number,
	exerciseId: number,
	alsoSections = false,
	now = Date.now(),
	by?: string
): boolean {
	return db.transaction((tx) => {
		const name = linkedName(tx, { exerciseId });
		let changes = tx
			.delete(lessonExercises)
			.where(
				and(eq(lessonExercises.lessonId, lessonId), eq(lessonExercises.exerciseId, exerciseId))
			)
			.run().changes;
		if (alsoSections) {
			const spots = (viaSections(tx, lessonId).exercises.get(exerciseId) ?? []).map(
				(s) => s.spotId
			);
			if (spots.length > 0) {
				changes += tx
					.delete(spotLinks)
					.where(and(eq(spotLinks.exerciseId, exerciseId), inArray(spotLinks.spotId, spots)))
					.run().changes;
			}
		}
		if (changes > 0) reconcileLesson(tx, lessonId, now);
		if (changes > 0) logUnlinked(tx, lessonId, { exerciseId }, name, by, now);
		return changes > 0;
	});
}

/**
 * Live variations in the lesson's space, by label; `linked` marks those already on the lesson.
 * A person's own lesson also offers the group variations they may use, after
 * their own, each tagged with its group (ruling 2).
 */
export function listLinkableFigures(
	db: Db,
	lessonId: number
): (FigureVersion & { linked: boolean })[] {
	const space = lessonSpace(db, lessonId);
	if (!space) return [];

	const linked = new Set(linkedFigureIds(db, lessonId));
	const theirs = isTeam(space) ? [] : usableVersions(db, space);
	return [...listVersions(db, space), ...theirs].map((v) => ({ ...v, linked: linked.has(v.id) }));
}

/**
 * Unarchived routines in the lesson's space, alphabetical; `linked` marks those already on it.
 * A person's own lesson also offers the group routines they may use, after
 * their own, each tagged with its group.
 */
export function listLinkableRoutines(db: Db, lessonId: number): PickRoutine[] {
	const space = lessonSpace(db, lessonId);
	if (!space) return [];

	const linked = new Set(linkedRoutineIds(db, lessonId));
	const theirs = isTeam(space) ? [] : listUsableRoutines(db, space);
	return [...listPickRoutines(db, space), ...theirs].map((r) => ({
		...r,
		linked: linked.has(r.id)
	}));
}

/**
 * Exercises this lesson could link: not archived, `linked` marking those already
 * on it, not owned by one of its figures or routines, and not any lesson's review exercise — a
 * review exercise belongs to the lesson that created it, and borrowing one
 * into a second lesson makes "whose is this?" unanswerable on screen.
 */
export function listLinkableExercises(db: Db, lessonId: number): PickExercise[] {
	const space = lessonSpace(db, lessonId);
	if (!space) return [];

	const alreadyLinked = new Set([
		...db
			.select({ id: lessonExercises.exerciseId })
			.from(lessonExercises)
			.where(eq(lessonExercises.lessonId, lessonId))
			.all()
			.map((r) => r.id),
		...viaSections(db, lessonId).exercises.keys()
	]);

	const linkedFigures = linkedFigureIds(db, lessonId);

	const where = [
		isNull(exercises.archivedAt),
		ne(exercises.source, 'lesson'),
		ownedBy(exercises, space)
	];
	if (linkedFigures.length > 0) {
		// `NOT IN` is null-propagating: a custom exercise has a null `figure_id`,
		// so `figure_id not in (…)` is NULL, not true, and would drop every custom
		// exercise from the picker. The explicit null arm is the whole point.
		where.push(or(isNull(exercises.figureId), notInArray(exercises.figureId, linkedFigures))!);
	}
	const linkedRoutines = linkedRoutineIds(db, lessonId);
	if (linkedRoutines.length > 0) {
		// The same null arm, for the same reason.
		where.push(or(isNull(exercises.routineId), notInArray(exercises.routineId, linkedRoutines))!);
	}

	const own: PickExercise[] = db
		.select({
			id: exercises.id,
			name: exercises.name,
			source: exercises.source,
			everyDays: exercises.everyDays,
			figure: figureGroups.name,
			variation: figures.name,
			owner: {
				dance: exercises.dance,
				userId: exercises.userId,
				teamId: exercises.teamId,
				figureId: exercises.figureId,
				routineId: exercises.routineId,
				drillId: exercises.drillId
			}
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(...where))
		.orderBy(asc(exercises.name), asc(exercises.id))
		.all()
		// An entry whose target is another space's is not this lesson's to link
		// (`linkExercise` refuses it): its own row is in the space, its content is not.
		.filter((r) => {
			const target = ownerRowOf(db, r.owner);
			return target !== null && inSpace(target, space);
		})
		.map(({ id, name, source, everyDays, figure, variation }) => ({
			id,
			name,
			source,
			everyDays,
			figure,
			variation,
			linked: alreadyLinked.has(id)
		}));
	// A person's own lesson: the group drills they may use too, after their own,
	// each tagged with its group (ruling 2). Never an entry (filtered above).
	const theirs: PickExercise[] = isTeam(space)
		? []
		: usableDrills(db, space).map((d) => ({
				...d,
				source: 'custom',
				figure: null,
				variation: null,
				linked: alreadyLinked.has(d.id)
			}));
	return [...own, ...theirs];
}

/** A lesson's new video; in a group, History says who added it (`by`). */
export function addLessonVideo(db: Db, input: LessonVideoInput, by?: string) {
	return db.transaction((tx) => {
		const video = tx.insert(lessonVideos).values(input).returning().get();
		const space = lessonSpace(tx, input.lessonId, by);
		if (space) logVideo(tx, space, input.lessonId, 'add', video.id, Date.now());
		return video;
	});
}

/** History's line for a lesson video added or deleted. */
function logVideo(
	tx: Db,
	space: Space,
	lessonId: number,
	verb: 'add' | 'remove',
	videoId: number,
	now: number,
	trashId: number | null = null
): void {
	logChange(
		tx,
		space,
		{ rootKind: 'lesson', rootId: lessonId, verb, subject: 'video', subjectId: videoId, trashId },
		now
	);
}

/**
 * Delete a video row and return it, with `trashId`, so the caller knows
 * whether to remove the file. Its spots go first, in the same transaction —
 * the foreign key would refuse the video otherwise. Throws `SpotLinkedError`,
 * deleting nothing, while one of its sections is linked to a figure or drill.
 *
 * A group's video goes to Recently deleted first, with its sections and its
 * file (`trashRows`): `trashId` is set and the caller must leave the file on
 * disk for the purge (risk 19). A person's has `trashId` null: the file goes now.
 */
export function deleteLessonVideo(db: Db, id: number, by?: string, now = Date.now()) {
	return db.transaction((tx) => {
		assertUnlinked(tx, { lessonVideoId: id });
		const spots = tx.select().from(videoSpots).where(eq(videoSpots.lessonVideoId, id)).all();
		tx.delete(videoSpots).where(eq(videoSpots.lessonVideoId, id)).run();
		const video = tx.delete(lessonVideos).where(eq(lessonVideos.id, id)).returning().get() ?? null;
		if (!video) return null;
		const space = lessonSpace(tx, video.lessonId, by);
		const trashId =
			space && isTeam(space)
				? trashRows(
						tx,
						space,
						'video',
						rootTitle(tx, 'lesson', video.lessonId),
						{ rootKind: 'lesson', rootId: video.lessonId },
						{ lesson_videos: [video], video_spots: spots },
						[{ dir: 'lessonVideos', file: video.file }],
						video.sizeBytes,
						now
					)
				: null;
		if (space) logVideo(tx, space, video.lessonId, 'remove', video.id, now, trashId);
		return { ...video, trashId };
	});
}

/**
 * The lessons that taught a figure — the lesson→figure link read from the
 * figure's side, which until now only the lesson page could show. Archived
 * lessons are gone from every list, so they are gone from this one. Only the
 * space's lessons: a lesson of someone else's never reaches this figure's page.
 */
export function taughtIn(db: Db, space: Space, figureId: number) {
	const ids = [
		...db
			.select({ id: lessonFigures.lessonId })
			.from(lessonFigures)
			.where(eq(lessonFigures.figureId, figureId))
			.all()
			.map((r) => r.id),
		// A section of one of the lesson's videos linked to it counts too.
		...lessonsReaching(db, { figureId })
	];
	if (ids.length === 0) return [];
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessons)
		.where(and(inArray(lessons.id, ids), ownedBy(lessons, space), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all();
}

/** `taughtIn`, for a routine: the lessons that link it, newest class first. */
export function routineTaughtIn(db: Db, space: Space, routineId: number) {
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessonRoutines)
		.innerJoin(lessons, eq(lessons.id, lessonRoutines.lessonId))
		.where(
			and(
				eq(lessonRoutines.routineId, routineId),
				ownedBy(lessons, space),
				isNull(lessons.archivedAt)
			)
		)
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all();
}

/**
 * The entry ids a link would sweep out of the lesson's hand-linked list: the
 * lesson's own person's entry for the target. A group's lesson hand-links no
 * entries (`linkExercise` refuses another person's), so it sweeps none.
 */
function ownEntryIds(db: Db, space: Space, target: EntryTarget): number[] {
	if (isTeam(space)) return [];
	const entry = entryFor(db, space.userId, target);
	return entry ? [entry.id] : [];
}
