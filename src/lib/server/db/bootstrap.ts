import { env } from '$env/dynamic/private';
import { seedAdmin } from '../admin';
import { sweepUploads } from '../files';
import { seedPositions } from '../positions';
import { UPLOAD_PARTIAL_TTL_MS } from '$lib/limits';
import { getDb } from './index';

let ready: Promise<void> | undefined;

/**
 * Open (and so migrate) the database and seed the admin, once per process.
 * Awaited by the first request so nothing can race an unmigrated schema.
 */
export function bootstrap(): Promise<void> {
	ready ??= seedAdmin(getDb(), env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
		.then(() => {
			// The handhold vocabulary, per dance, if that dance has none. Cheap and
			// idempotent, and the figure pickers are empty without it.
			seedPositions(getDb());
		})
		.then(() => {
			// Abandoned chunked uploads, swept once per process rather than by a
			// cron or a unit there would be nothing to remind anyone about. Not
			// awaited: a slow disk must not hold up the first request, and a
			// failure here is never worth a 500.
			void sweepUploads(UPLOAD_PARTIAL_TTL_MS).catch(() => {});
		})
		.catch((err) => {
			ready = undefined;
			throw err;
		});
	return ready;
}
