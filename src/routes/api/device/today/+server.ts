import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { dueByDance } from '$lib/server/devices';
import type { RequestHandler } from './$types';
import { serverNow } from '$lib/server/server-clock';

/** What is due right now in each dance — the Android app's daily reminder. */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) throw error(401);
	return json(dueByDance(getDb(), locals.user.id, serverNow(), locals.user.timezone));
};
