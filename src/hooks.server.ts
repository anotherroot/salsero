import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { bootstrap } from '$lib/server/db/bootstrap';
import { apiDeviceUser } from '$lib/server/request-user';
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
	'/manifest-salsa.webmanifest',
	'/manifest-bachata.webmanifest',
	'/icon.svg',
	'/icon-192.png',
	'/icon-512.png',
	'/icons/salsa-192.png',
	'/icons/salsa-512.png',
	'/icons/bachata-192.png',
	'/icons/bachata-512.png',
	// Chrome fetches it unauthenticated to verify the Android app (a TWA).
	'/.well-known/assetlinks.json'
]);

/** The home worker's API: no session, a bearer token instead. */
const WORKER_PREFIX = '/api/worker/';

export const handle: Handle = async ({ event, resolve }) => {
	await bootstrap();

	const session = validateSession(event.cookies.get(SESSION_COOKIE));
	const path = event.url.pathname;
	// No session: a paired Android app may still sign in with its device
	// token — on the API only, never a page and never the worker's prefix.
	event.locals.user = session
		? { id: session.userId, email: session.email, timezone: session.timezone }
		: apiDeviceUser(getDb(), path, event.request.headers.get('authorization'), Date.now());

	// The Android app's launchers open with ?app=android. Remember it per
	// browser, so every page after the first knows to offer native links.
	if (event.url.searchParams.get(APP_PARAM) === APP_VALUE) {
		event.cookies.set(APP_COOKIE, APP_VALUE, {
			path: '/',
			maxAge: 365 * 24 * 3600,
			sameSite: 'lax',
			httpOnly: true
		});
	}

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
