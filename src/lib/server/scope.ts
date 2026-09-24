/**
 * Which dance a request is allowed to touch, and the rows it may reach by id.
 *
 * `/salsa/…` and `/bachata/…` are the same code with a different slug, and the
 * ids in a form body are just numbers — nothing in them says which dance they
 * came from. Without a check, a POST to `/salsa` carrying a bachata id acts on
 * the other side of the wall while the URL claims otherwise. That is worse than
 * the reading version of the same bug, because it mutates.
 *
 * The detail pages (a figure, a lesson) hold their own guard on top of these,
 * because each also decides what "archived" means for its own row. Everything
 * else is shared: exercises and sets are reached from both Today and the
 * player, and a song from both the list and its own page.
 *
 * A missing row and a row from the other dance get the same answer, 404 — the
 * same one the detail pages give, and deliberately indistinguishable: telling
 * them apart would confirm that some other dance owns that id.
 */
import { error } from '@sveltejs/kit';
import type { Db } from './db';
import { getExercise, getSet } from './exercises';
import { getPosition } from './positions';
import { getSong } from './songs';
import { isDanceSlug, type DanceSlug } from '$lib/dances/dances';

/**
 * The dance this URL names, or a 404.
 *
 * `[dance]/+layout.server.ts` validates the slug too, but a form action runs
 * BEFORE any load — so on a POST the layout's gate has not happened yet and
 * `params.dance` is whatever was typed. Without this, `POST /kizomba?/create`
 * would insert a row with `dance='kizomba'`, and the column deliberately has
 * no CHECK to catch it (see `schema.ts`), so the invariant has to live here.
 *
 * It also replaces the `params.dance as DanceSlug` cast, which was the thing
 * silencing the compiler about exactly this.
 */
export function danceOf(params: { dance: string }): DanceSlug {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	return params.dance;
}

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

/**
 * The song, or a 404.
 *
 * Both the songs list and a song's own page act on a song by id — `retry` on
 * the list, seven actions on the page — so the dance rule lives here and is
 * called from both. Archived is a separate question the detail page asks after
 * this one, because the list's retry has its own answer for it.
 */
export function requireSongInDance(db: Db, dance: DanceSlug, id: number) {
	const song = getSong(db, id);
	if (!song || song.dance !== dance) throw error(404, 'Song not found');
	return song;
}

/**
 * The position, or a 404.
 *
 * A position id in a form body is just a number, and the vocabulary page acts
 * on one from three different actions — so the dance rule lives here and is
 * called from each. An archived position is still a position: the page's own
 * list is what stops it being offered, and refusing it here would make renaming
 * one impossible.
 */
export function requirePositionInDance(db: Db, dance: DanceSlug, id: number) {
	const position = getPosition(db, id);
	if (!position || position.dance !== dance) throw error(404, 'No such position');
	return position;
}
