/**
 * The hook's form check and the paths it must treat alike. PURE.
 *
 * Copied from homestash (itself from muscle_model): kit's own CSRF check is
 * switched off in `vite.config.ts` and re-done here with one exemption,
 * because an AI app's token exchange is a form POST with no Origin.
 */

/**
 * Paths that answer for themselves (a bearer token, a code, or nothing at all):
 * the hook gives them no session user, no login redirect and no host redirect.
 * `/oauth/authorize` is NOT here: it is a page behind the session, and its
 * form post is checked like any other.
 */
export const SELF_AUTHED_PATHS: ReadonlySet<string> = new Set([
	'/mcp',
	'/oauth/token',
	'/oauth/register',
	'/.well-known/oauth-protected-resource',
	'/.well-known/oauth-protected-resource/mcp',
	'/.well-known/oauth-authorization-server'
]);

/** Call with `routedPath(url.pathname)`, never the raw path. */
export function isSelfAuthed(routed: string): boolean {
	return SELF_AUTHED_PATHS.has(routed);
}

/** The content types SvelteKit's own CSRF check protects (kit 2.70, `is_form_content_type`). */
const FORM_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata'
];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * SvelteKit's CSRF check, re-implemented with ONE exemption.
 *
 * Kit refuses a form POST whose `Origin` is not the app's, including one with
 * no `Origin` at all, before the hook runs, in production builds only. The
 * token exchange is exactly that request: form-encoded, server-to-server, no
 * `Origin`. Kit has no per-route exemption, so its check is off
 * (`csrf.trustedOrigins: ['*']`) and this one runs in the hook, identical
 * except for `/oauth/token`, which authenticates by the code or refresh token
 * in its body and holds no cookie-based authority. (`/oauth/register` takes
 * JSON, which was never a form type: it needs no exemption.)
 */
export function isCrossSiteForm(
	req: { method: string; contentType: string | null; origin: string | null },
	appOrigin: string,
	path: string
): boolean {
	if (path === '/oauth/token') return false;
	if (!MUTATING.has(req.method.toUpperCase())) return false;
	const type = (req.contentType ?? '').split(';')[0].trim().toLowerCase();
	if (!FORM_TYPES.includes(type)) return false;
	return req.origin !== appOrigin;
}

/**
 * Mirrors kit's own `decode_pathname` exactly, so a path checked here is the
 * string kit routes on (a percent-encoded `/oauth/%74oken` cannot dodge or
 * borrow an exemption). A malformed escape makes `decodeURI` throw; this runs
 * before kit's own 400, so it falls back to the raw path rather than throw.
 */
export function routedPath(pathname: string): string {
	try {
		return pathname.split('%25').map(decodeURI).join('%25');
	} catch {
		return pathname;
	}
}
