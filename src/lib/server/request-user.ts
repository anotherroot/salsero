import type { Db } from './db';
import { bearerToken, userForDeviceToken } from './devices';

/**
 * The user a paired Android app signs in as, or null.
 *
 * Only under `/api/` — a page never accepts a device token, so a leaked token
 * reads JSON and uploads files but cannot drive the forms. And never under
 * `/api/worker/`, which has its own token and its own gate in the hook.
 */
export function apiDeviceUser(db: Db, path: string, authorization: string | null, now: number) {
	if (!path.startsWith('/api/') || path.startsWith('/api/worker/')) return null;
	const token = bearerToken(authorization);
	return token ? userForDeviceToken(db, token, now) : null;
}
