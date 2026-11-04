import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { copyPlan, intoOf } from '$lib/server/clones/copy-to';
import type { CloneKind } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * The Copy to… sheet's cards for the place picked (board C4):
 * `?kind=lesson&id=<id>&into=mine|<group id>`, what would go, what the place
 * has already, and the twins questions (`copyPlan`). Flat like
 * `/api/clones/compare`: a row the person cannot read, or a place that is not
 * one of its targets, is a 404.
 */
const KINDS: readonly CloneKind[] = ['figure', 'routine', 'drill', 'song', 'lesson', 'position'];

export const GET: RequestHandler = ({ url, locals }) => {
	const kind = url.searchParams.get('kind') as CloneKind | null;
	if (!kind || !KINDS.includes(kind)) throw error(404, 'Not found');
	const raw = url.searchParams.get('id');
	const id = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(id) || id <= 0) throw error(404, 'Not found');
	const user = locals.user!;
	const db = getDb();
	const into = intoOf(db, user.id, kind, id, url.searchParams.get('into'));
	if (!into) throw error(404, 'Not found');
	return json(copyPlan(db, user.id, kind, id, into, user.timezone));
};
