import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { linkOptionsFor } from '$lib/server/link-popup';
import { allows, spotAccess } from '$lib/server/access';
import { unlinkFromSection } from '$lib/server/spot-links';
import { unlinkSpotFromPosition } from '$lib/server/position-links';
import type { RequestHandler } from './$types';
import { serverNow } from '$lib/server/server-clock';

const id = (raw: string, what: string): number => {
	const n = /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(n) || n <= 0) throw error(404, `No such ${what}`);
	return n;
};

/**
 * Unlink; `?alsoLesson=1` takes the lesson's hand link to the same target too.
 * A position link lives in its own table, so its ids are its own: `?kind=position`
 * names that table, and without it the id is a variation's or drill's link.
 */
export const DELETE: RequestHandler = ({ params, url, locals }) => {
	const spotId = id(params.id, 'section');
	const linkId = id(params.linkId, 'link');
	const kind = url.searchParams.get('kind');
	if (kind !== null && kind !== 'position') throw error(404, 'No such link');
	const db = getDb();
	// Another person's section, and a group's this person does not edit, are a
	// missing one: checked before anything is deleted.
	if (!locals.user || !allows(spotAccess(db, locals.user.id, spotId), 'edit')) {
		throw error(404, 'No such section');
	}
	const alsoLesson = url.searchParams.get('alsoLesson') === '1';
	const gone =
		kind === 'position'
			? unlinkSpotFromPosition(db, linkId, serverNow(), locals.user.id, { spotId, alsoLesson })
			: unlinkFromSection(db, spotId, linkId, alsoLesson, serverNow(), locals.user.id);
	if (!gone) throw error(404, 'No such link');
	const options = linkOptionsFor(db, spotId, locals.user!.id);
	if (!options) throw error(404, 'No such section');
	return json(options);
};
