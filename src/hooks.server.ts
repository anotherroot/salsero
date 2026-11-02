import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { bootstrap } from '$lib/server/db/bootstrap';
import { needsName } from '$lib/names';
import { apiDeviceUser } from '$lib/server/request-user';
import { workerTokenOk } from '$lib/server/worker-auth';
import { THEME_COOKIE, fillTheme, themeChoice } from '$lib/theme/scheme';

/**
 * Routes reachable without a session. Everything else redirects to /login.
 *
 * Deny-by-default is deliberate: with no Cloudflare Access in front of this
 * host, forgetting a guard on one route is the whole breach. A new page is
 * private unless someone consciously adds it here.
 */
const PUBLIC_PATHS = new Set([
	'/login',
	// The invite's link carries its code in the query string, so the path is what is public.
	'/join',
	'/health',
	'/manifest-salsa.webmanifest',
	'/manifest-bachata.webmanifest',
	'/icon-salsa.svg',
	'/icon-bachata.svg',
	'/icons/salsa-192.png',
	'/icons/salsa-512.png',
	'/icons/bachata-192.png',
	'/icons/bachata-512.png',
	// The APK's signing-key fingerprint (docs/deployment.md). The WebView app (since
	// 2026-10-29) does not read it; Chrome still may.
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
		? {
				id: session.userId,
				email: session.email,
				firstName: session.firstName,
				lastName: session.lastName,
				timezone: session.timezone,
				isAdmin: session.isAdmin
			}
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
	if (event.locals.user && (path === '/login' || path === '/join')) {
		throw redirect(303, '/');
	}
	// Accounts made before names are asked for one before anything else.
	if (needsName(path, event.locals.user)) {
		throw redirect(303, `/welcome?next=${encodeURIComponent(path + event.url.search)}`);
	}

	// Light or dark, as chosen in Settings: written into <html> for app.html's script.
	const theme = themeChoice(event.cookies.get(THEME_COOKIE));
	return resolve(event, { transformPageChunk: ({ html }) => fillTheme(html, theme) });
};
