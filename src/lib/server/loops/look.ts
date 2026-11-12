/**
 * The preview sheet's data (picker preview, S1): a figure's label, notes,
 * positions, counts, where it is from, and the video of the section its row's
 * picture was cut from. Read as the person: another person's row, another
 * dance's, a missing one and a group's out of their reach are all null (one
 * 404). The section is the one the row names (its picture's file name), so the
 * row and the sheet always show the same video; it is checked to be linked to
 * this figure and on a video the person may watch, else no video.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import {
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	lessons,
	lessonVideos,
	positions,
	recordings,
	spotLinks,
	videoSpots
} from '../db/schema';
import { allows, judgeFigure, judgeMove, lessonVideoAccess, recordingAccess } from '../access';
import { teamRefs } from '../usable';
import { labelFor } from '../figures';
import { looksFor } from './pictures';
import { countsOfMask } from '$lib/graph/timing';
import { pictureOf } from '$lib/video/loops';
import type { DanceSlug } from '$lib/dances/dances';
import type { FigureSheet, MoveSheet } from '$lib/types';

type Person = { id: string; dance: DanceSlug };

function names(db: Db, figureId: number, side: 'start' | 'end'): string[] {
	const t = side === 'start' ? figureStartPositions : figureEndPositions;
	return db
		.select({ name: positions.name })
		.from(t)
		.innerJoin(positions, eq(positions.id, t.positionId))
		.where(eq(t.figureId, figureId))
		.orderBy(asc(positions.name))
		.all()
		.map((r) => r.name);
}

/** The section's video, when it is linked to this figure and the person may watch it. */
function sectionVideo(
	db: Db,
	userId: string,
	figureId: number,
	spotId: number
): FigureSheet['video'] {
	const link = db
		.select({ id: spotLinks.id })
		.from(spotLinks)
		.where(and(eq(spotLinks.spotId, spotId), eq(spotLinks.figureId, figureId)))
		.get();
	const spot = db.select().from(videoSpots).where(eq(videoSpots.id, spotId)).get();
	if (!link || !spot || spot.endMs === null) return null;
	const span = { startMs: spot.startMs, endMs: spot.endMs };
	if (spot.lessonVideoId !== null) {
		const v = db.select().from(lessonVideos).where(eq(lessonVideos.id, spot.lessonVideoId)).get();
		if (!v || !allows(lessonVideoAccess(db, userId, v), 'read')) return null;
		const lesson = db
			.select({ title: lessons.title, lessonDay: lessons.lessonDay })
			.from(lessons)
			.where(eq(lessons.id, v.lessonId))
			.get()!;
		return { src: `/lesson-videos/${v.file}`, ...span, from: { kind: 'lesson', ...lesson } };
	}
	const r = db.select().from(recordings).where(eq(recordings.id, spot.recordingId!)).get();
	if (!r || r.kind !== 'video' || !allows(recordingAccess(db, userId, r), 'read')) return null;
	return { src: `/recordings/${r.file}`, ...span, from: { kind: 'recording' } };
}

export function figureSheet(
	db: Db,
	person: Person,
	figureId: number,
	spotId: number | null
): FigureSheet | null {
	const row = db
		.select({ figure: figures, move: figureGroups.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.id, figureId))
		.get();
	if (!row || row.figure.dance !== person.dance) return null;
	const f = row.figure;
	const { access } = judgeFigure(db, person.id, f);
	if (!allows(access, 'read')) return null;
	const video = spotId === null ? null : sectionVideo(db, person.id, f.id, spotId);
	const team = f.teamId === null ? null : (teamRefs(db, [f.teamId]).get(f.teamId) ?? null);
	return {
		id: f.id,
		label: labelFor(row.move, f.name),
		notes: f.notes,
		starts: names(db, f.id, 'start'),
		ends: names(db, f.id, 'end'),
		startCount: countsOfMask(f.startCounts, f.startCount).join('/'),
		length: f.lengthFree ? null : f.lengthCounts,
		from: team
			? { kind: 'group', name: team.name, readOnly: !allows(access, 'edit') }
			: { kind: 'mine' },
		video,
		picture: video && spotId !== null ? pictureOf({ id: spotId, ...video }) : null
	};
}

export function moveSheet(db: Db, person: Person, moveId: number): MoveSheet | null {
	const move = db.select().from(figureGroups).where(eq(figureGroups.id, moveId)).get();
	if (!move || move.dance !== person.dance) return null;
	if (!allows(judgeMove(db, person.id, move).access, 'read')) return null;
	const vs = db
		.select({ id: figures.id, name: figures.name, userId: figures.userId, teamId: figures.teamId })
		.from(figures)
		.where(and(eq(figures.groupId, moveId), isNull(figures.archivedAt)))
		.orderBy(asc(figures.id))
		.all();
	const looks = looksFor(
		db,
		vs.map((v) => v.id),
		{ viewer: person.id, ownSections: true }
	);
	return {
		id: move.id,
		name: move.name,
		variations: vs
			// A reader sees only the variations in their reach.
			.filter((v) => looks.has(v.id) && allows(judgeFigure(db, person.id, v).access, 'read'))
			.map((v) => ({ id: v.id, name: v.name, look: looks.get(v.id)! }))
	};
}
