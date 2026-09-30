/**
 * What a log popup shows above its form, fetched when the popup opens. Loading
 * this for every row would make Today pay for every lesson's videos and every
 * figure's recordings on each visit; fetched per popup, Today stays as light
 * as it was.
 *
 * This is the one server place that branches on the type, because each type's
 * content lives in different tables. The components never branch — they ask
 * the registry for the type's popup.
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures } from './db/schema';
import { lastSet } from './exercises';
import { getFigure } from './figures';
import { getLesson } from './lessons';
import { listLinks } from './links';
import { getRoutine, routineSlots } from './routines';
import { daysBetween, localDay } from '$lib/day/day';
import { typeOf } from '$lib/exercises/kinds';
import { DEFAULT_LENGTH_COUNTS, eightsSpan } from '$lib/graph/timing';
import type { PracticeContent, PracticePayload } from '$lib/types';

type Exercise = typeof exercises.$inferSelect;

export function practicePayload(
	db: Db,
	exercise: Exercise,
	tz: string,
	now: number
): PracticePayload {
	const set = lastSet(db, exercise.id);
	return {
		content: contentOf(db, exercise),
		last: set && { ...set, daysAgo: daysBetween(localDay(set.doneAt, tz), localDay(now, tz)) }
	};
}

/** What an owned exercise shows if its owner row has vanished: its own notes, like a drill. */
const bare = (exercise: Exercise): PracticeContent => ({
	type: 'drill',
	notes: exercise.notes,
	links: []
});

function contentOf(db: Db, exercise: Exercise): PracticeContent {
	switch (typeOf(exercise.source)) {
		case 'lesson': {
			const found = exercise.lessonId === null ? null : getLesson(db, exercise.lessonId);
			if (!found) return bare(exercise);
			const { lesson } = found;
			return {
				type: 'lesson',
				lesson: {
					id: lesson.id,
					title: lesson.title,
					lessonDay: lesson.lessonDay,
					notes: lesson.notes
				},
				links: listLinks(db, { lessonId: lesson.id }),
				videos: found.videos,
				figures: found.figures.map((f) => ({ id: f.id, name: f.name }))
			};
		}
		case 'figure': {
			const found = exercise.figureId === null ? null : getFigure(db, exercise.figureId);
			if (!found) return bare(exercise);
			const { figure } = found;
			return {
				type: 'figure',
				figure: {
					id: figure.id,
					name: figure.name,
					notes: figure.notes,
					say: figure.callText ?? figure.name,
					eights: eightsSpan(figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS)
				},
				links: listLinks(db, { figureId: figure.id }),
				recordings: found.recordings.map((r) => ({
					id: r.id,
					file: r.file,
					kind: r.kind,
					sizeBytes: r.sizeBytes,
					createdAt: r.createdAt
				}))
			};
		}
		case 'routine': {
			if (exercise.routineId === null) return bare(exercise);
			const routine = getRoutine(db, exercise.routineId);
			if (!routine) return bare(exercise);
			// Every figure of the dance, archived included: a slot can still name one.
			const names = new Map(
				db
					.select({ id: figures.id, name: figures.name })
					.from(figures)
					.where(eq(figures.dance, exercise.dance))
					.all()
					.map((f) => [f.id, f.name] as [number, string])
			);
			return {
				type: 'routine',
				routine: { id: routine.id, name: routine.name, notes: routine.notes },
				slots: routineSlots(db, routine.id).map((s) => ({
					note: s.note,
					names:
						s.childId !== null
							? [s.childName ?? 'A routine']
							: s.figureIds.map((id) => names.get(id) ?? `#${id}`)
				}))
			};
		}
		case 'drill':
			return {
				type: 'drill',
				notes: exercise.notes,
				links: listLinks(db, { exerciseId: exercise.id })
			};
	}
}
