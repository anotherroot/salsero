/**
 * Dance scoping for rows a route reaches by id.
 *
 * `/salsa/…` and `/bachata/…` are the same code with a different slug, and the
 * ids in a form body are just numbers — nothing in them says which dance they
 * came from. Without a check, a POST to `/salsa` carrying a bachata id acts on
 * the other side of the wall while the URL claims otherwise. That is worse than
 * the reading version of the same bug, because it mutates.
 *
 * The detail pages (a figure, a song, a lesson) each hold their own guard,
 * because each also decides what "archived" and "not found" mean for its own
 * row. Exercises and sets are reached from BOTH Today and the player, so their
 * guard lives here and is shared rather than written twice.
 *
 * A missing row and a row from the other dance get the same answer, 404 — the
 * same one the detail pages give, and deliberately indistinguishable: telling
 * them apart would confirm that some other dance owns that id.
 */
import { error } from '@sveltejs/kit';
import type { Db } from './db';
import { getExercise, getSet } from './exercises';
import type { DanceSlug } from '$lib/dances/dances';

/** The exercise if it belongs to this dance, else null — for reads that degrade. */
export function exerciseInDance(db: Db, dance: DanceSlug, id: number) {
	const found = getExercise(db, id);
	return found && found.dance === dance ? found : null;
}

/**
 * The exercise, or a 404. Anything that writes by id uses this: a mismatch must
 * stop the request, not fall through to a friendlier message that still acted.
 */
export function requireExerciseInDance(db: Db, dance: DanceSlug, id: number) {
	const found = exerciseInDance(db, dance, id);
	if (!found) throw error(404, 'No such exercise');
	return found;
}

/**
 * The set, or a 404. A set has no `dance` column: it is the dance of its
 * exercise, resolved through `exerciseId` rather than denormalised — which is
 * the same rule the schema already follows for recordings and lesson videos.
 */
export function requireSetInDance(db: Db, dance: DanceSlug, id: number) {
	const set = getSet(db, id);
	if (!set) throw error(404, 'No such set');
	requireExerciseInDance(db, dance, set.exerciseId);
	return set;
}
