import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { dueByDance } from '$lib/server/devices';
import type { RequestHandler } from './$types';

/** What is due right now in each dance — the Android app's daily reminder. */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) throw error(401);
	return json(dueByDance(getDb(), Date.now(), locals.user.timezone));
};
