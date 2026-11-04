import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { compareWith } from '$lib/server/clones/compare';
import type { CloneKind } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * The compare sheet's data (board C2 p3): `?kind=figure&mine=<id>&theirs=<id>`,
 * the two members side by side from `mine`'s side (`compareWith`). Flat like
 * `/api/video-spots`: the rows' own walls decide, and anything the person
 * cannot read on either side, or two rows of different families, is a 404.
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
	const user = locals.user!;
	const c = compareWith(
		getDb(),
		user.id,
		kind,
		id(url.searchParams.get('mine')),
		id(url.searchParams.get('theirs')),
		{ tz: user.timezone }
	);
	if (!c) throw error(404, 'Not found');
	return json(c);
};
