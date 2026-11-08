/**
 * What a New position form posts, read and checked: the positions list's
 * `create` and the lesson page's `newPosition` take the same fields with the
 * same refusals. A blank or taken name is `createPosition`'s to refuse.
 */
import { optionalText } from './form';
import { DANCES, type DanceSlug } from '$lib/dances/dances';
import { parseHold } from '$lib/positions/hold';
import { t } from '$lib/i18n/catalog';
import type { PositionInput } from '$lib/types';

export type NewPositionTyped = { name: string; notes: string; styleTag: string };

export function readNewPosition(
	form: FormData,
	dance: DanceSlug
):
	| { input: PositionInput; typed: NewPositionTyped }
	| { field: 'name' | 'notes'; message: string; typed: NewPositionTyped } {
	const styleTag = String(form.get('styleTag') ?? '');
	const typed = {
		name: String(form.get('name') ?? ''),
		notes: String(form.get('notes') ?? ''),
		styleTag
	};
	const notes = optionalText(form, 'notes');
	if (notes === undefined) {
		return { field: 'notes', message: t().positions.refused.notesLong, typed };
	}
	if (typed.name.trim().length > 200) {
		return { field: 'name', message: t().positions.refused.nameLong, typed };
	}
	return {
		input: {
			name: typed.name,
			styleTag: DANCES[dance].styles.includes(styleTag) ? styleTag : null,
			hold: parseHold(form),
			notes,
			pictureSpotId: null
		},
		typed
	};
}
