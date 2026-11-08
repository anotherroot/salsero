import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deviceSettings } from '$lib/server/devices';
import type { RequestHandler } from './$types';

/** The Android app's settings: when to remind, what size to compress to, and its language. */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) throw error(401);
	return json(deviceSettings(getDb(), locals.user.id));
};
