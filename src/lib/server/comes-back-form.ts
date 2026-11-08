/**
 * Reads the Comes back fields of an exercise settings form. Fields: `comesBack`
 * (`faces` | `every` | `teacher`), `until` (`on`), `good` (`3` | `5`), `every`
 * (`1` | `2` | `3` | `7`). PURE apart from the FormData it reads.
 */
import { FACES, type ComesBack } from '$lib/schedule/comes-back';
import { checkbox } from './form';

export type ComesBackRead = ComesBack | 'teacher' | 'invalid' | undefined;

/**
 * `undefined` keeps what is stored (no `comesBack` field); `'invalid'` is a value out of
 * range. `since` of an `until` stays when the stored value is already `until` (the switch
 * stayed on), else it is `now`.
 */
export function readComesBack(
	form: FormData,
	current: ComesBack | null,
	now: number
): ComesBackRead {
	const mode = form.get('comesBack');
	if (mode === null) return undefined;
	if (mode === 'teacher') return 'teacher';
	if (mode === 'faces') {
		if (form.get('until') !== 'on') return FACES;
		const good = Number(form.get('good'));
		if (good !== 3 && good !== 5) return 'invalid';
		return { kind: 'until', good, since: current?.kind === 'until' ? current.since : now };
	}
	if (mode === 'every') {
		const days = Number(form.get('every'));
		return days === 1 || days === 2 || days === 3 || days === 7
			? { kind: 'every', days }
			: 'invalid';
	}
	return 'invalid';
}

/**
 * The Warm-up switch. An unchecked checkbox posts nothing, so the form also sends a
 * `warmupSent` marker: without it the switch is kept (undefined); with it, the box decides.
 */
export function readWarmup(form: FormData): boolean | undefined {
	return form.has('warmupSent') ? checkbox(form, 'warmup') : undefined;
}
