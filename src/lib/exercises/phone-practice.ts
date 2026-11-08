/**
 * What this phone last practised with: one object per dance in the browser
 * store, under `<dance>.player` (the key the full player always used, so what a
 * phone already stored survives). Read through `parsePhonePractice`; written by
 * the full player and the panel alike. An exercise's own memory beats it
 * (`practiceSeed`); it is the start for a player opened without an exercise,
 * an exercise never practised, and the voice volume everywhere.
 *
 * Every access is wrapped: private-mode Safari throws on any localStorage use.
 */
const keyOf = (danceSlug: string) => `${danceSlug}.player`;

export function loadPhonePractice(danceSlug: string): Record<string, unknown> {
	try {
		const raw = localStorage.getItem(keyOf(danceSlug));
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

/** Merge `patch` into what is stored, so the panel never wipes a field only the full player keeps. */
export function savePhonePractice(danceSlug: string, patch: object) {
	try {
		localStorage.setItem(
			keyOf(danceSlug),
			JSON.stringify({ ...loadPhonePractice(danceSlug), ...patch })
		);
	} catch {
		// Private mode, or storage full: the settings just don't persist.
	}
}

/**
 * A routine's Follow or Still on this phone, per routine (`routineViews` in the
 * same object). Follow until it is changed.
 */
export function loadRoutineView(danceSlug: string, routineId: number): 'follow' | 'still' {
	const views = loadPhonePractice(danceSlug).routineViews;
	const v =
		views && typeof views === 'object' ? (views as Record<string, unknown>)[routineId] : undefined;
	return v === 'still' ? 'still' : 'follow';
}

export function saveRoutineView(danceSlug: string, routineId: number, view: 'follow' | 'still') {
	const views = loadPhonePractice(danceSlug).routineViews;
	const kept = views && typeof views === 'object' ? (views as Record<string, unknown>) : {};
	savePhonePractice(danceSlug, { routineViews: { ...kept, [routineId]: view } });
}
