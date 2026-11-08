import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { storeImportItems } from '$lib/server/song-imports';
import type { RequestHandler } from './$types';

/**
 * The worker's read of a list: `{ name, items, truncated }`. 204 stored; 410
 * when the list is no longer wanted (Cancel, Dismiss: the worker takes it as
 * done); 400 for a report that is no list or too long.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (body === null || typeof body !== 'object') throw error(400, 'Not a list');
	const r = storeImportItems(getDb(), Number(params.id), {
		name: body.name,
		items: body.items,
		truncated: body.truncated
	});
	if (r === 'gone') throw error(410, 'This list is no longer wanted');
	if (r === 'bad') throw error(400, 'Not a list, or too long');
	return new Response(null, { status: 204 });
};
