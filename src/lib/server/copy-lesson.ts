/**
 * Make my own copy: a group lesson, and what it holds, becomes the person's
 * own, to edit freely. See "Make my own copy" in
 * docs/superpowers/specs/2026-11-02-groups-design.md.
 *
 * What is copied: the lesson (with its own review exercise, as `createLesson`
 * makes), its videos (under new file names), their sections and section
 * links, its links; the variations in the lesson's reach (`reachFrom`) with
 * their timing, positions and links; its routines and the routines they
 * embed, slots remapped; its drills with their links. Recordings are not
 * copied, and the person's practice entries stay on the group's lesson.
 *
 * Names (risk 14): a variation joins the person's live figure of the same name
 * (trimmed, any case — the rule `figureNameTaken` keeps unique), or a new
 * figure of that name. A variation name already taken there gets the group's
 * name: "Doble (Salsa nadaljevalna)", then "Doble (Salsa nadaljevalna 2)".
 * Routines and drills have no name rule, so theirs are copied as they are.
 *
 * The files are linked before the rows are written (a hard link under a new
 * name: the group's purge unlinks the group's names only), and the rows go in
 * one transaction. When the transaction fails, the new names are unlinked.
 * The copy is charged to the person in full, like any upload.
 */
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull, sum } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figureStartPositions,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	links,
	routines,
	routineStepOptions,
	routineSteps,
	spotLinks,
	videoSpots,
	type Lesson
} from './db/schema';
import { allows, lessonAccess, reachFrom } from './access';
import { ownedBy, ownerValues, type Wall } from './scope';
import { getTeam } from './teams';
import { roomForOwner, type Room } from './storage';
import { createLesson, linkExercise, linkFigure, linkRoutine } from './lessons';
import { variationNameTaken } from './figures';
import { createCustomExercise } from './exercises';
import { createRoutine, routineSlots } from './routines';
import { addSpot } from './spots';
import { linkInSpace } from './spot-links';
import type { DanceSlug } from '$lib/dances/dances';
import type { CopySummary } from '$lib/types';

/** Where the lesson videos live and how one is linked under a new name (`linkCopy`). */
export type CopyFiles = {
	/** `lessonVideosDir()`; a temp folder in specs. */
	dir: string;
	/** The file under a new name in `dir`; returns the new name. */
	link(dir: string, file: string): Promise<string>;
};

export type CopyResult =
	{ ok: true; lessonId: number } | { ok: false; room: Extract<Room, { ok: false }> };

const norm = (name: string) => name.trim().toLowerCase();

/**
 * The group lesson this person may copy: one they can read, of a group. A
 * person's own lesson, an archived one and one they cannot read get the
 * missing lesson's 404.
 */
function copyable(db: Db, userId: string, lessonId: number): Lesson & { teamId: number } {
	const lesson = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (
		!lesson ||
		lesson.teamId === null ||
		lesson.archivedAt !== null ||
		!allows(lessonAccess(db, userId, lesson), 'read')
	) {
		throw error(404, 'No such lesson');
	}
	return lesson as Lesson & { teamId: number };
}

function videoBytes(db: Db, lessonId: number): number {
	const row = db
		.select({ t: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, lessonId))
		.get();
	return Number(row?.t ?? 0);
}

/** The bytes of the lesson's videos: what a copy is charged. */
export function copyCost(db: Db, userId: string, lessonId: number): number {
	copyable(db, userId, lessonId);
	return videoBytes(db, lessonId);
}

/** `copyCost`, with how many videos, variations, routines and drills the copy brings. */
export function copySummary(db: Db, userId: string, lessonId: number): CopySummary {
	const lesson = copyable(db, userId, lessonId);
	const reach = reachFrom(db, lesson.teamId, [lesson.id]);
	const videos = db
		.select({ id: lessonVideos.id })
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, lesson.id))
		.all().length;
	return {
		bytes: videoBytes(db, lesson.id),
		videos,
		variations: reach.variations.size,
		routines: reach.routines.size,
		drills: reach.drills.size
	};
}

/**
 * Copy a group lesson into this person's own space of its dance. Needs `read`
 * (a member, a former member who added it, an editor); a refusal is the
 * missing lesson's 404. Refused, writing nothing, when it does not fit the
 * person's room or would leave the disk under the floor. Copying twice makes
 * two copies.
 */
export async function copyLesson(
	db: Db,
	userId: string,
	lessonId: number,
	now: number,
	files: CopyFiles,
	freeDiskBytes = Number.POSITIVE_INFINITY
): Promise<CopyResult> {
	const lesson = copyable(db, userId, lessonId);
	const room = roomForOwner(db, { userId }, videoBytes(db, lesson.id), freeDiskBytes);
	if (!room.ok) return { ok: false, room };

	const videos = db
		.select()
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, lesson.id))
		.orderBy(asc(lessonVideos.id))
		.all();
	const linked = new Map<number, string>();
	const unlinkAll = () =>
		Promise.all([...linked.values()].map((f) => unlink(join(files.dir, f)).catch(() => {})));
	try {
		for (const v of videos) linked.set(v.id, await files.link(files.dir, v.file));
		const wall: Wall = { userId, dance: lesson.dance as DanceSlug };
		const id = db.transaction((tx) => copyRows(tx, lesson, wall, linked, now));
		return { ok: true, lessonId: id };
	} catch (err) {
		await unlinkAll();
		throw err;
	}
}

/** Every row of the copy, inside one transaction. Returns the new lesson's id. */
function copyRows(
	tx: Db,
	lesson: Lesson & { teamId: number },
	wall: Wall,
	files: Map<number, string>,
	now: number
): number {
	const teamName = getTeam(tx, lesson.teamId)?.name ?? 'group';
	const reach = reachFrom(tx, lesson.teamId, [lesson.id]);
	const made = createLesson(tx, wall, {
		lessonDay: lesson.lessonDay,
		title: lesson.title,
		notes: lesson.notes
	}).lesson;

	const variationMap = copyVariations(tx, wall, [...reach.variations], teamName, now);
	const drillMap = copyDrills(tx, wall, [...reach.drills], now);
	const routineMap = copyRoutines(tx, wall, [...reach.routines], variationMap, now);

	// The videos, their sections, and the sections' links to the copies.
	for (const [videoId, file] of files) {
		const v = tx.select().from(lessonVideos).where(eq(lessonVideos.id, videoId)).get()!;
		const video = tx
			.insert(lessonVideos)
			.values({
				lessonId: made.id,
				file,
				mime: v.mime,
				sizeBytes: v.sizeBytes,
				sourceUrl: v.sourceUrl,
				createdAt: now
			})
			.returning({ id: lessonVideos.id })
			.get();
		const spots = tx
			.select()
			.from(videoSpots)
			.where(eq(videoSpots.lessonVideoId, videoId))
			.orderBy(asc(videoSpots.id))
			.all();
		for (const s of spots) {
			const spot = addSpot(
				tx,
				{ lessonVideoId: video.id },
				{ startMs: s.startMs, endMs: s.endMs, label: s.label }
			)!;
			const targets = tx
				.select()
				.from(spotLinks)
				.where(eq(spotLinks.spotId, s.id))
				.orderBy(asc(spotLinks.id))
				.all();
			for (const t of targets) {
				// A target out of the lesson's reach (archived) stays behind.
				const target =
					t.figureId !== null
						? variationMap.has(t.figureId)
							? { figureId: variationMap.get(t.figureId)! }
							: null
						: drillMap.has(t.exerciseId!)
							? { exerciseId: drillMap.get(t.exerciseId!)! }
							: null;
				if (target) linkInSpace(tx, wall, spot.id, target);
			}
		}
	}

	// What the lesson links by hand.
	// A hand link to something out of reach (archived) stays behind.
	for (const { id } of tx
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lesson.id))
		.all()) {
		const copy = variationMap.get(id);
		if (copy !== undefined) linkFigure(tx, made.id, copy);
	}
	for (const { id } of tx
		.select({ id: lessonRoutines.routineId })
		.from(lessonRoutines)
		.where(eq(lessonRoutines.lessonId, lesson.id))
		.all()) {
		const copy = routineMap.get(id);
		if (copy !== undefined) linkRoutine(tx, made.id, copy);
	}
	for (const { id } of tx
		.select({ id: lessonExercises.exerciseId })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lesson.id))
		.all()) {
		const copy = drillMap.get(id);
		if (copy !== undefined) linkExercise(tx, made.id, copy);
	}

	copyLinks(tx, { lessonId: lesson.id }, { lessonId: made.id }, now);
	return made.id;
}

type LinkOwner = { lessonId: number } | { figureId: number } | { exerciseId: number };

/** A lesson's, a variation's or a drill's links, onto its copy. Saves in flight stay behind. */
function copyLinks(tx: Db, from: LinkOwner, to: LinkOwner, now: number): void {
	const where =
		'lessonId' in from
			? eq(links.lessonId, from.lessonId)
			: 'figureId' in from
				? eq(links.figureId, from.figureId)
				: eq(links.exerciseId, from.exerciseId);
	const rows = tx.select().from(links).where(where).orderBy(asc(links.id)).all();
	if (rows.length === 0) return;
	tx.insert(links)
		.values(rows.map((l) => ({ ...to, url: l.url, title: l.title, createdAt: now })))
		.run();
}

/**
 * The variations, each into the person's figure of the same name or a new one,
 * with their shape and links. Returns the group's id → the copy's.
 */
function copyVariations(
	tx: Db,
	wall: Wall,
	ids: number[],
	teamName: string,
	now: number
): Map<number, number> {
	const out = new Map<number, number>();
	if (ids.length === 0) return out;
	const rows = tx
		.select({ v: figures, figureName: figureGroups.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(inArray(figures.id, ids))
		.orderBy(asc(figures.id))
		.all();
	const mine = tx
		.select({ id: figureGroups.id, name: figureGroups.name })
		.from(figureGroups)
		.where(and(ownedBy(figureGroups, wall), isNull(figureGroups.archivedAt)))
		.orderBy(asc(figureGroups.id))
		.all();
	const groupFor = (name: string): number => {
		const found = mine.find((g) => norm(g.name) === norm(name));
		if (found) return found.id;
		const group = tx
			.insert(figureGroups)
			.values({ ...ownerValues(wall), name, createdAt: now })
			.returning({ id: figureGroups.id, name: figureGroups.name })
			.get();
		mine.push(group);
		return group.id;
	};
	for (const { v, figureName } of rows) {
		const groupId = groupFor(figureName);
		let name = v.name;
		for (let n = 1; variationNameTaken(tx, groupId, name, null); n++) {
			name = n === 1 ? `${v.name} (${teamName})` : `${v.name} (${teamName} ${n})`;
		}
		const copy = tx
			.insert(figures)
			.values({
				...ownerValues(wall),
				groupId,
				name,
				notes: v.notes,
				partner: v.partner,
				styleTag: v.styleTag,
				endPositionId: v.endPositionId,
				startCount: v.startCount,
				lengthCounts: v.lengthCounts,
				createdAt: now
			})
			.returning({ id: figures.id })
			.get();
		const starts = tx
			.select({ positionId: figureStartPositions.positionId })
			.from(figureStartPositions)
			.where(eq(figureStartPositions.figureId, v.id))
			.all();
		if (starts.length > 0) {
			tx.insert(figureStartPositions)
				.values(starts.map((s) => ({ figureId: copy.id, positionId: s.positionId })))
				.run();
		}
		copyLinks(tx, { figureId: v.id }, { figureId: copy.id }, now);
		out.set(v.id, copy.id);
	}
	return out;
}

/**
 * The drills, with their practice settings and links. A group drill never
 * holds a song, so neither does the copy. Returns the group's id → the copy's.
 */
function copyDrills(tx: Db, wall: Wall, ids: number[], now: number): Map<number, number> {
	const out = new Map<number, number>();
	if (ids.length === 0) return out;
	const rows = tx
		.select()
		.from(exercises)
		.where(inArray(exercises.id, ids))
		.orderBy(asc(exercises.id))
		.all();
	for (const d of rows) {
		const copy = createCustomExercise(tx, wall, {
			name: d.name,
			everyDays: d.everyDays,
			notes: d.notes
		});
		tx.update(exercises)
			.set({ practiceMode: d.practiceMode, countBpm: d.countBpm, practiceJson: d.practiceJson })
			.where(eq(exercises.id, copy.id))
			.run();
		copyLinks(tx, { exerciseId: d.id }, { exerciseId: copy.id }, now);
		out.set(d.id, copy.id);
	}
	return out;
}

/**
 * The routines (each with its own exercise, as `createRoutine` makes), then
 * their slots: options and embedded routines remapped to the copies. An option
 * or a child out of reach (archived) stays behind; a slot left with nothing
 * goes. Returns the group's id → the copy's.
 */
function copyRoutines(
	tx: Db,
	wall: Wall,
	ids: number[],
	variationMap: Map<number, number>,
	now: number
): Map<number, number> {
	const out = new Map<number, number>();
	if (ids.length === 0) return out;
	const rows = tx
		.select()
		.from(routines)
		.where(inArray(routines.id, ids))
		.orderBy(asc(routines.id))
		.all();
	for (const r of rows) {
		out.set(r.id, createRoutine(tx, wall, { name: r.name, notes: r.notes }).routine.id);
	}
	for (const r of rows) {
		let position = 0;
		for (const slot of routineSlots(tx, r.id)) {
			const child = slot.childId === null ? null : (out.get(slot.childId) ?? null);
			const options = slot.figureIds
				.map((f) => variationMap.get(f))
				.filter((f): f is number => f !== undefined);
			if (slot.childId !== null ? child === null : options.length === 0) continue;
			const step = tx
				.insert(routineSteps)
				.values({
					routineId: out.get(r.id)!,
					position: position++,
					childRoutineId: child,
					note: slot.note,
					createdAt: now
				})
				.returning({ id: routineSteps.id })
				.get();
			// In the slot's order, main figure first: see `MAIN_FIRST` in routines.ts.
			for (const figureId of options) {
				tx.insert(routineStepOptions).values({ stepId: step.id, figureId, createdAt: now }).run();
			}
		}
	}
	return out;
}
