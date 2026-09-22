import { env } from '$env/dynamic/private';
import { seedAdmin } from '../admin';
import { getDb } from './index';

let ready: Promise<void> | undefined;

/**
 * Open (and so migrate) the database and seed the admin, once per process.
 * Awaited by the first request so nothing can race an unmigrated schema.
 */
export function bootstrap(): Promise<void> {
	ready ??= seedAdmin(getDb(), env.ADMIN_EMAIL, env.ADMIN_PASSWORD).catch((err) => {
		ready = undefined;
		throw err;
	});
	return ready;
}
