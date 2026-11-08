import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { parseAppAgent, parseAppVersion } from '$lib/app-update/agent';
import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { EPOCH_HEADER, PAGE_EPOCH, fillEpoch, staleAnswer, staleEpoch } from '$lib/page-epoch';
import { refusesOldApp } from '$lib/server/app-gate';
import { noteAppSeen } from '$lib/server/app-seen';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { bootstrap } from '$lib/server/db/bootstrap';
import { needsLevel, needsName } from '$lib/names';
import { parseLevel } from '$lib/levels/levels';
import { currentRelease } from '$lib/server/releases';
import { isPublicPath } from '$lib/server/public-paths';
import { danceHosts } from '$lib/server/hosts';
import { hostRedirect } from '$lib/dances/hosts';
import { apiDeviceUser } from '$lib/server/request-user';
import { workerTokenOk } from '$lib/server/worker-auth';
import { THEME_COOKIE, fillTheme, themeChoice } from '$lib/theme/scheme';
import { serverNow } from '$lib/server/server-clock';

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
				isAdmin: session.isAdmin,
				level: parseLevel(session.level),
				dance: session.dance
			}
		: apiDeviceUser(getDb(), path, event.request.headers.get('authorization'), serverNow());

	// Which app asks: its user agent suffix, else the native header.
	const native = parseAppVersion(event.request.headers.get('x-app-version'));
	const appAgent = parseAppAgent(event.request.headers.get('user-agent')) ?? native;
	event.locals.appAgent = appAgent;
	// Only the native API is refused (426): a page's own `/api/` calls inside the
	// WebView carry the user agent, not the header, and a page out of date is
	// the page epoch's job. A take recorded on My count still saves.
	if (native && refusesOldApp(path, native, currentRelease(native.dance))) {
		return new Response(JSON.stringify({ message: 'Update the app to keep using it.' }), {
			status: 426,
			headers: { 'content-type': 'application/json' }
		});
	}
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

	// Each dance on its own host (the dance split): the other dance's pages, and a
	// session of the other dance's account, go to their own host.
	const moved = hostRedirect({
		hosts: danceHosts(),
		host: event.url.host,
		protocol: event.url.protocol,
		path,
		search: event.url.search,
		method: event.request.method,
		userDance: event.locals.user?.dance ?? null
	});
	if (moved.kind === 'redirect') throw redirect(303, moved.to);
	if (moved.kind === 'missing') return new Response('Not found', { status: 404 });

	// Which app this person uses, noted only for a request this host keeps.
	if (event.locals.user && appAgent) {
		noteAppSeen(getDb(), event.locals.user.id, appAgent, serverNow());
	}

	// A page older than a breaking deploy (`$lib/page-epoch.ts`): refused before
	// anything acts on what it sent, so it reloads instead. Full page loads, the
	// Android app's own calls and the worker carry no epoch and are never refused.
	if (staleEpoch(event.request.headers.get(EPOCH_HEADER), PAGE_EPOCH)) {
		return staleAnswer(event.request.headers.has('x-sveltekit-action'));
	}

	const isPublic = isPublicPath(path) || path.startsWith('/_app/');

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

	// A new account has not chosen how much app yet: the first run asks.
	if (needsLevel(path, event.locals.user)) {
		throw redirect(303, `/welcome/start?next=${encodeURIComponent(path + event.url.search)}`);
	}

	// Light or dark, as chosen in Settings, and the page epoch: written into
	// <html> for app.html's script.
	const theme = themeChoice(event.cookies.get(THEME_COOKIE));
	return resolve(event, {
		transformPageChunk: ({ html }) => fillEpoch(fillTheme(html, theme))
	});
};
