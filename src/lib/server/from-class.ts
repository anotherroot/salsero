import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { exercises } from './db/schema';
import { drillAddRoute } from './entries';
import { getLessonRow } from './lessons';

/**
 * The class an exercise is from, for the simple exercise page's "From class
 * Tue 3 Nov ›" (null: none). `exercise` is the row the URL names:
 * - a lesson review: its own lesson;
 * - a person's entry on a group's drill (`drillId` set): the lesson that holds
 *   that drill, through `drillAddRoute`;
 * - a group's drill itself: the same route, whether or not the person has an entry.
 */
export function fromClassOf(
	db: Db,
	userId: string,
	exercise: { id: number; teamId: number | null; lessonId: number | null; drillId: number | null }
): { lessonId: number; day: string } | null {
	let lessonId = exercise.lessonId;
	if (lessonId === null) {
		const drill =
			exercise.drillId !== null
				? db.select().from(exercises).where(eq(exercises.id, exercise.drillId)).get()
				: exercise;
		if (drill)
			lessonId =
				drillAddRoute(db, userId, { id: drill.id, teamId: drill.teamId })?.lessonId ?? null;
	}
	const lesson = lessonId === null ? null : getLessonRow(db, lessonId);
	return lesson ? { lessonId: lesson.id, day: lesson.lessonDay } : null;
}
