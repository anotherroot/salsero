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
import type { Db } from './db';
import { exercises } from './db/schema';
import { lastSet } from './exercises';
import { figureLabels, getFigure, getGroup } from './figures';
import { getLesson } from './lessons';
import { listLinks } from './links';
import { sectionsFor, type Visible } from './spot-links';
import { getRoutine, routineSlots } from './routines';
import { daysBetween, localDay } from '$lib/day/day';
import { typeOf } from '$lib/exercises/kinds';
import { DEFAULT_LENGTH_COUNTS, eightsSpan } from '$lib/graph/timing';
import { spaceOfRow, type Space } from './scope';
import type { PracticeContent, PracticePayload } from '$lib/types';

type Exercise = typeof exercises.$inferSelect;

export function practicePayload(
	db: Db,
	exercise: Exercise,
	tz: string,
	now: number
): PracticePayload {
	return { content: contentOf(db, exercise), last: lastOf(db, exercise.id, tz, now) };
}

/**
 * A group drill's page: the drill's own content, with only what this reader
 * reaches of its sections (`visible`; omitted for an editor), and the last set
 * of this person's own entry for it. Never the drill row's sets: nobody logs on
 * a group's row (risk 22).
 */
export function drillPayload(
	db: Db,
	drill: Exercise,
	entryId: number | null,
	tz: string,
	now: number,
	visible?: Visible
): PracticePayload {
	return {
		content: {
			type: 'drill',
			notes: drill.notes,
			links: listLinks(db, { exerciseId: drill.id }),
			sections: sectionsFor(db, { exerciseId: drill.id }, visible)
		},
		last: entryId === null ? null : lastOf(db, entryId, tz, now)
	};
}

function lastOf(db: Db, exerciseId: number, tz: string, now: number): PracticePayload['last'] {
	const set = lastSet(db, exerciseId);
	return set && { ...set, daysAgo: daysBetween(localDay(set.doneAt, tz), localDay(now, tz)) };
}

/** What an owned exercise shows if its owner row has vanished: its own notes, like a drill. */
const bare = (exercise: Exercise): PracticeContent => ({
	type: 'drill',
	notes: exercise.notes,
	links: [],
	sections: []
});

function contentOf(db: Db, exercise: Exercise): PracticeContent {
	switch (typeOf(exercise.source)) {
		case 'lesson': {
			const found =
				exercise.lessonId === null ? null : getLesson(db, exercise.lessonId, exercise.userId ?? '');
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
			const found =
				exercise.figureId === null ? null : getFigure(db, exercise.figureId, exercise.userId ?? '');
			if (!found) return bare(exercise);
			const { figure } = found;
			// Read in the figure's own space: an entry's figure may be a group's.
			const label = figureLabels(db, targetSpace(figure, exercise)).get(figure.id) ?? figure.name;
			// The voice says the figure's name; the label is for showing.
			const say = (figure.groupId !== null && getGroup(db, figure.groupId)?.name) || figure.name;
			return {
				type: 'figure',
				figure: {
					id: figure.id,
					name: label,
					say,
					notes: figure.notes,
					eights: eightsSpan(figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS)
				},
				links: listLinks(db, { figureId: figure.id }),
				recordings: found.recordings.map((r) => ({
					id: r.id,
					file: r.file,
					kind: r.kind,
					sizeBytes: r.sizeBytes,
					sourceUrl: r.sourceUrl,
					createdAt: r.createdAt
				})),
				sections: sectionsFor(db, { figureId: figure.id })
			};
		}
		case 'routine': {
			if (exercise.routineId === null) return bare(exercise);
			const routine = getRoutine(db, exercise.routineId);
			if (!routine) return bare(exercise);
			// Every figure of the routine's space, archived included: a slot can still
			// name one. A variation reads "Enchufla · Doble". The routine's space, not
			// the exercise's: an entry's routine may be a group's.
			const names = figureLabels(db, targetSpace(routine, exercise));
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
				links: listLinks(db, { exerciseId: exercise.id }),
				sections: sectionsFor(db, { exerciseId: exercise.id })
			};
	}
}

/**
 * The space a target (a figure or routine) stands in, with the exercise's
 * person acting: its figures are read against it. An entry's own owner is its
 * person, but its target may be a group's, and only the target's space holds
 * the names its slots use.
 */
function targetSpace(
	target: { dance: string; userId: string | null; teamId: number | null },
	exercise: Exercise
): Space {
	return spaceOfRow(target, exercise.userId ?? '');
}
