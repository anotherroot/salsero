/**
 * The Add sheet's form, shared by the group page, a group lesson's page and a
 * group drill's page: the lesson and the ticked picks.
 */
import { ints, int } from './form';
import type { AddPicks } from '$lib/types';

export function readAdd(form: FormData): { lessonId: number | undefined; picks: AddPicks } {
	return {
		lessonId: int(form, 'lessonId'),
		picks: {
			lesson: form.get('lesson') === 'on',
			routineIds: ints(form, 'routineIds'),
			drillIds: ints(form, 'drillIds'),
			figureIds: ints(form, 'figureIds')
		}
	};
}
