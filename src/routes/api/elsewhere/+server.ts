import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { elsewhereGroup, findElsewhere } from '$lib/server/elsewhere';
import type { DanceSlug } from '$lib/dances/dances';
import type { ElsewhereFind } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * Link from other places: what a group's pickers find in the
 * person's own app and their other groups while they search
 * (`?into=<group id>&kinds=figure,drill&q=cradle`). The server's alone
 * (network): the device keeps no other group's rows, and a copy runs online.
 * Flat: the account's dance is the dance; a group the person does not edit
 * is a 404.
 */
const KINDS: readonly ElsewhereFind[] = ['figure', 'routine', 'drill', 'position', 'move'];

export const GET: RequestHandler = ({ url, locals }) => {
	const user = locals.user!;
	const raw = url.searchParams.get('into') ?? '';
	const teamId = /^\d+$/.test(raw) ? Number(raw) : 0;
	const kinds = (url.searchParams.get('kinds') ?? '').split(',');
	if (
		!Number.isSafeInteger(teamId) ||
		teamId <= 0 ||
		kinds.some((k) => !KINDS.includes(k as ElsewhereFind))
	)
		throw error(404, t().refusals.notFound);
	const db = getDb();
	const group = elsewhereGroup(db, user.id, user.dance as DanceSlug, teamId);
	if (!group) throw error(404, t().refusals.notFound);
	const q = (url.searchParams.get('q') ?? '').slice(0, 100);
	return json(findElsewhere(db, group, kinds as ElsewhereFind[], q));
};
