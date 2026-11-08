import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { syncView } from '$lib/server/clones/sync';
import type { CloneKind } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * The Sync sheet's data: `?kind=figure&id=<id>`, the merge across every copy
 * the person reads and the copies they edit to land it on (`syncView`). Flat
 * like `/api/clones/copy`: a row the person does not read, or one with
 * nothing to sync, is a 404.
 */
const KINDS: readonly CloneKind[] = ['figure', 'routine', 'drill', 'song', 'lesson', 'position'];

function id(raw: string | null): number {
	const n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
	if (!Number.isSafeInteger(n) || n <= 0) throw error(404, 'Not found');
	return n;
}

export const GET: RequestHandler = ({ url, locals }) => {
	const kind = url.searchParams.get('kind') as CloneKind | null;
	if (!kind || !KINDS.includes(kind)) throw error(404, 'Not found');
	const user = locals.user!;
	const view = syncView(getDb(), user.id, kind, id(url.searchParams.get('id')), {
		tz: user.timezone
	});
	if (!view) throw error(404, 'Not found');
	return json(view);
};
