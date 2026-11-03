/**
 * Routes reachable without a session. Everything else redirects to /login.
 *
 * Deny-by-default is deliberate: with no Cloudflare Access in front of this
 * host, forgetting a guard on one route is the whole breach. A new page is
 * private unless someone consciously adds it here.
 */
export const PUBLIC_PATHS = new Set([
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

/** Public by pattern: the update check and a published APK (never its `.part` or `current.json`). */
const PUBLIC_PATTERNS = [
	/^\/api\/app-update\/(salsa|bachata)$/,
	/^\/releases\/(salsa|bachata)\/\d+\.apk$/
];

export function isPublicPath(path: string): boolean {
	return PUBLIC_PATHS.has(path) || PUBLIC_PATTERNS.some((re) => re.test(path));
}
