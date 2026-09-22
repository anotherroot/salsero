import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { bootstrap } from '$lib/server/db/bootstrap';

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

export const handle: Handle = async ({ event, resolve }) => {
	await bootstrap();

	const session = validateSession(event.cookies.get(SESSION_COOKIE));
	event.locals.user = session
		? { id: session.userId, email: session.email, timezone: session.timezone }
		: null;

	const path = event.url.pathname;
	// The home worker has no session: its routes check a bearer token themselves.
	const isPublic =
		PUBLIC_PATHS.has(path) || path.startsWith('/_app/') || path.startsWith('/api/worker/');

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
