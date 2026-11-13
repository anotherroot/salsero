import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getExercise } from '$lib/server/exercises';
import { hearingSongsOf } from '$lib/server/hearing';
import { requireExerciseAccess } from '$lib/server/scope';
import { hearingOf, settingsFrom } from '$lib/hearing/drill';
import { typeOf } from '$lib/exercises/kinds';
import { t } from '$lib/i18n/catalog';
import type { PageServerLoad } from './$types';

/**
 * A hearing drill's round (spec 2026-11-10, phase 2): the drill's settings, a
 * link's changes for this once (`changed`: a class member's Spremeni), and the
 * songs a person counted, in the drill's order. An entry plays its class
 * drill's settings and songs, so the teacher's edit reaches everyone. No song
 * to play: a 404 that says why, never a round graded on the computer's guess.
 * Reads only the drill and its songs, so the phone answers it from its copy.
 */
export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const { exercise: row } = requireExerciseAccess(db, locals, params, params.id, 'read');
	const drill = row.drillId === null ? row : getExercise(db, row.drillId);
	if (!drill || typeOf(drill) !== 'hearing') throw error(404, t().refusals.noExercise);
	const { settings, changed } = settingsFrom(url.searchParams, hearingOf(drill.practiceJson));
	const { usable } = hearingSongsOf(db, locals.user!.id, drill.id);
	if (usable.length === 0) throw error(404, t().refusals.noHearingSongs);
	return { exercise: { id: row.id, name: drill.name }, settings, changed, songs: usable };
};
