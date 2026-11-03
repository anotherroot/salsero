/**
 * The New lesson sheet's post, read and checked: one place for the Lessons tab
 * and a group's page, which post the same sheet.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import { int, optionalText, text } from './form';
import { isValidDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
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
 * The lesson to make and how often to go over it, or the refusal to return
 * carrying what was typed. `frequency` is whether the sheet asks how often: a
 * person's lesson gets its review exercise; a group's gets none (each member's
 * Add makes their own).
 */
export function readNewLesson(
	form: FormData,
	today: string,
	frequency: boolean
): { input: LessonInput; everyDays: number | undefined } | { refused: NewLessonRefusal } {
	const title = text(form, 'title');
	const notes = optionalText(form, 'notes');
	const everyDays = frequency ? int(form, 'everyDays') : undefined;
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

	if (!title) return refuse('Give it a title (up to 200 characters).', 'title');
	if (notes === undefined) return refuse('Notes are up to 2000 characters.', 'notes');
	if (frequency && (everyDays === undefined || !isFrequency(everyDays))) {
		return refuse('Pick how often to go over it.');
	}
	if (!isValidDay(lessonDay)) return refuse('Pick the day of the class.', 'lessonDay');
	// A class you have not attended yet is not a lesson — the same instinct the
	// Today page has about future days.
	if (lessonDay > today) return refuse('That day is in the future.', 'lessonDay');
	return { input: { lessonDay, title, notes }, everyDays };
}
