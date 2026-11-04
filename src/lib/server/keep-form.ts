import type { KeepChoice } from '$lib/types';

/**
 * A Keep choice from a form body or a query string: `mode` is `all`, `used`
 * or `chosen`; `chosen` carries the ids as repeated `lesson`, `figure`,
 * `routine` and `song` fields. Null for a missing or unknown mode.
 */
export function readKeepChoice(data: FormData | URLSearchParams): KeepChoice | null {
	const mode = data.get('mode');
	if (mode === 'all' || mode === 'used') return { mode };
	if (mode !== 'chosen') return null;
	const ids = (name: string) =>
		data
			.getAll(name)
			.map((v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : 0))
			.filter((n) => n > 0);
	return {
		mode: 'chosen',
		lessons: ids('lesson'),
		figures: ids('figure'),
		routines: ids('routine'),
		songs: ids('song')
	};
}
