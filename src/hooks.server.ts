import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { APP_HEADER, parseAppAgent, parseAppVersion } from '$lib/app-update/agent';
import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { EPOCH_HEADER, PAGE_EPOCH, fillEpoch, staleAnswer, staleEpoch } from '$lib/page-epoch';
import { refusesOldApp } from '$lib/server/app-gate';
import { noteAppSeen } from '$lib/server/app-seen';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { bootstrap } from '$lib/server/db/bootstrap';
import { deviceRuntime, deviceUser } from '$lib/server/device-runtime';
import { gatedRequest, writeGate } from '$lib/server/sync/gate';
import { replaying } from '$lib/server/replay-context';
import { setIdSlot } from '$lib/server/db/ids';
import { needsLevel, needsName } from '$lib/names';
import { parseLevel } from '$lib/levels/levels';
import { currentRelease } from '$lib/server/releases';
import { isPublicPath } from '$lib/server/public-paths';
import { danceHosts } from '$lib/server/hosts';
import { hostRedirect } from '$lib/dances/hosts';
import { apiDeviceUser } from '$lib/server/request-user';
import { workerTokenOk } from '$lib/server/worker-auth';
import { THEME_COOKIE, fillTheme } from '$lib/theme/scheme';
import { LOCALE_COOKIE, requestLocale } from '$lib/i18n/locale';
import { catalogOf } from '$lib/i18n/catalog';
// Imported for its side: it registers the per-request language with `$lib/i18n/current`.
import { runInLocale } from '$lib/server/i18n-request';
import { fillLang, inviteLocaleOf } from '$lib/server/locale';

import { serverNow } from '$lib/server/server-clock';
import { isCrossSiteForm, isSelfAuthed, routedPath } from '$lib/server/csrf';
import { noteWorkerSeen } from '$lib/server/worker-seen';

/** What the CSRF check reads from a request. */
const formOf = (r: Request) => ({
	method: r.method,
	contentType: r.headers.get('content-type'),
	origin: r.headers.get('origin')
});

/** The home worker's API: no session, a bearer token instead. */
const WORKER_PREFIX = '/api/worker/';

export const handle: Handle = async ({ event, resolve }) => {
	await bootstrap();

	// The path kit routes on (`/m%63p` is `/mcp`): every check below that names a
	// path judges this one, so an encoded path can neither dodge nor borrow one.
	const routed = routedPath(event.url.pathname);

	// The AI connector's own endpoints answer for themselves (a bearer token, a
	// code, or nothing): no session, no login or host redirect, machine English.
	if (isSelfAuthed(routed)) {
		event.locals.user = null;
		event.locals.appAgent = null;
		event.locals.locale = 'en';
		if (isCrossSiteForm(formOf(event.request), event.url.origin, routed))
			return new Response(catalogOf('en').refusals.crossSite, { status: 403 });
		return resolve(event);
	}

	const device = deviceRuntime();
	// The device mints its new rows' ids in its own slot (offline phase 3).
	if (device && device.slot !== null) setIdSlot(device.slot);
	// Every write but the sync's own holds the write gate shared, so a replay can run alone.
	const gated = gatedRequest(
		event.request.method,
		event.url.pathname,
		device !== null,
		replaying() !== undefined
	);
	const pass = (run: () => Promise<Response>) => (gated ? writeGate.shared(run) : run());
	const session = device ? null : validateSession(event.cookies.get(SESSION_COOKIE));
	// Every gate below judges the routed path: an encoded `/api/%77orker/` is still the worker's.
	const path = routed;
	// No session: a paired Android app may still sign in with its device
	// token — on the API only, never a page and never the worker's prefix.
	// On the device the user is the copy's own person: no session, no token.
	event.locals.user = device
		? deviceUser(getDb(), device.userId)
		: session
			? {
					id: session.userId,
					email: session.email,
					firstName: session.firstName,
					lastName: session.lastName,
					timezone: session.timezone,
					isAdmin: session.isAdmin,
					level: parseLevel(session.level),
					dance: session.dance,
					locale: session.locale
				}
			: apiDeviceUser(getDb(), path, event.request.headers.get('authorization'), serverNow());

	// The language this request is drawn in: a signed-in person's own; signed out,
	// the invite's on Join, then the browser's cookie, then its Accept-Language, then English.
	const loc = requestLocale({
		user: event.locals.user,
		cookie: event.cookies.get(LOCALE_COOKIE),
		acceptLanguage: event.request.headers.get('accept-language'),
		invite:
			path === '/join' ? inviteLocaleOf(getDb(), event.url.searchParams.get('code') ?? '') : null
	});
	event.locals.locale = loc;

	// Kit's own CSRF check is off (vite.config.ts) for the connector's token
	// request; this is the same check, for everything else.
	if (isCrossSiteForm(formOf(event.request), event.url.origin, routed))
		return new Response(catalogOf(loc).refusals.crossSite, { status: 403 });

	// Which app asks: its user agent suffix, else the page's own word for it (a request the
	// service worker sent on carries the worker's user agent: `APP_HEADER`), else the native header.
	const native = parseAppVersion(event.request.headers.get('x-app-version'));
	const appAgent =
		parseAppAgent(event.request.headers.get('user-agent')) ??
		parseAppAgent(event.request.headers.get(APP_HEADER)) ??
		native;
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
		noteWorkerSeen(serverNow());
		// The worker reads no words: English, whatever its cookies say.
		event.locals.locale = 'en';
		return pass(() => Promise.resolve(resolve(event)));
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
	if (moved.kind === 'missing')
		return new Response(catalogOf(loc).refusals.notFound, { status: 404 });

	// Which app this person uses, noted only for a request this host keeps.
	if (event.locals.user && appAgent && !device && !replaying()) {
		noteAppSeen(getDb(), event.locals.user.id, appAgent, serverNow());
	}

	// A page older than a breaking deploy (`$lib/page-epoch.ts`): refused before
	// anything acts on what it sent, so it reloads instead. Full page loads, the
	// Android app's own calls and the worker carry no epoch and are never refused.
	if (staleEpoch(event.request.headers.get(EPOCH_HEADER), PAGE_EPOCH)) {
		return runInLocale(loc, () => staleAnswer(event.request.headers.has('x-sveltekit-action')));
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
	// <html> for app.html's script. The language goes into `<html lang>`.
	const theme = event.cookies.get(THEME_COOKIE);
	// Every word drawn for this request reads its language from here (`runInLocale`).
	return pass(() =>
		Promise.resolve(
			runInLocale(loc, () =>
				resolve(event, {
					transformPageChunk: ({ html }) => fillLang(fillEpoch(fillTheme(html, theme)), loc)
				})
			)
		)
	);
};
