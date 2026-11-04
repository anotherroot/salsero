import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { accessTo } from '$lib/server/clones/genes';
import { sendPreview } from '$lib/server/clones/send';
import type { CloneKind } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * The send sheet's data (board C3 p2): `?kind=figure&from=<id>`, every other
 * member the person edits compared from its own side (`sendPreview`). Flat
 * like `/api/clones/compare`: a row the person does not edit is a 404, and so
 * is one they do not read at all.
 */
const KINDS: readonly CloneKind[] = ['figure', 'routine', 'drill', 'song', 'lesson'];

function id(raw: string | null): number {
	const n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(n) || n <= 0) throw error(404, 'Not found');
	return n;
}

export const GET: RequestHandler = ({ url, locals }) => {
	const kind = url.searchParams.get('kind') as CloneKind | null;
	if (!kind || !KINDS.includes(kind)) throw error(404, 'Not found');
	const db = getDb();
	const from = id(url.searchParams.get('from'));
	if (accessTo(db, locals.user!.id, kind, from) !== 'edit') throw error(404, 'Not found');
	return json(sendPreview(db, locals.user!.id, kind, from, { tz: locals.user!.timezone }));
};
