import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songsWantingStart } from '$lib/server/songs';
import type { RequestHandler } from './$types';

/**
 * The worker's one-off pass: ready songs whose music start is not measured
 * yet. The worker token is checked in hooks.server.ts for all of /api/worker/.
 */
export const GET: RequestHandler = () => json(songsWantingStart(getDb()).map((id) => ({ id })));
