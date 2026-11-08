/**
 * The New lesson sheet's post, read and checked: one place for the Lessons tab
 * and a group's page, which post the same sheet.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import { optionalText, text } from './form';
import { isValidDay } from '$lib/day/day';
import { t } from '$lib/i18n/catalog';
import type { LessonInput } from './lessons';

type Field = 'lessonDay' | 'title' | 'notes';
export type NewLessonRefusal = ActionFailure<{
	action: 'create';
	field?: Field;
	message: string;
	title: string;
	notes: string;
	lessonDay: string;
}>;

/**
 * The lesson to make, or the refusal to return carrying what was typed. The
 * sheet no longer asks how often to go over it: the review exercise starts at
 * the column default and the schedule takes over from there.
 */
export function readNewLesson(
	form: FormData,
	today: string
): { input: LessonInput } | { refused: NewLessonRefusal } {
	const title = text(form, 'title');
	const notes = optionalText(form, 'notes');
	const lessonDay = String(form.get('lessonDay') ?? '');
	const entered = {
		title: String(form.get('title') ?? ''),
		notes: String(form.get('notes') ?? ''),
		lessonDay
	};

	const refuse = (message: string, field?: Field) => ({
		refused: fail(400, {
			action: 'create' as const,
			...(field ? { field } : {}),
			message,
			...entered
		})
	});

	if (!title) return refuse(t().lesson.refused.title, 'title');
	if (notes === undefined) return refuse(t().moves.refused.notes, 'notes');
	if (!isValidDay(lessonDay)) return refuse(t().lesson.refused.day, 'lessonDay');
	// A class you have not attended yet is not a lesson — the same instinct the
	// Today page has about future days.
	if (lessonDay > today) return refuse(t().lesson.refused.future, 'lessonDay');
	return { input: { lessonDay, title, notes } };
}
