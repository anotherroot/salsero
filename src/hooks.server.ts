import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { bootstrap } from '$lib/server/db/bootstrap';
import { workerTokenOk } from '$lib/server/worker-auth';

/**
 * Routes reachable without a session. Everything else redirects to /login.
 *
 * Deny-by-default is deliberate: with no Cloudflare Access in front of this
 * host, forgetting a guard on one route is the whole breach. A new page is
 * private unless someone consciously adds it here.
 */
const PUBLIC_PATHS = new Set([
	'/login',
	'/health',
	'/manifest.webmanifest',
	'/icon.svg',
	'/icon-192.png',
	'/icon-512.png'
]);

/** The home worker's API: no session, a bearer token instead. */
const WORKER_PREFIX = '/api/worker/';

export const handle: Handle = async ({ event, resolve }) => {
	await bootstrap();

	const session = validateSession(event.cookies.get(SESSION_COOKIE));
	event.locals.user = session
		? { id: session.userId, email: session.email, timezone: session.timezone }
		: null;

	const path = event.url.pathname;
	// The home worker has no session; its bearer token is checked here, the one
	// gate for everything under the prefix (the routes do not check it again).
	if (path.startsWith(WORKER_PREFIX)) {
		if (!workerTokenOk(event.request.headers.get('authorization'), env.SALSA_WORKER_TOKEN)) {
			return new Response('Bad worker token', { status: 401 });
		}
		return resolve(event);
	}

	const isPublic = PUBLIC_PATHS.has(path) || path.startsWith('/_app/');

	if (!event.locals.user && !isPublic) {
		// API calls get a status, not a redirect to an HTML page they cannot use.
		if (path.startsWith('/api/')) return new Response('Not signed in', { status: 401 });
		throw redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}
	if (event.locals.user && path === '/login') {
		throw redirect(303, '/');
	}

	return resolve(event);
};
