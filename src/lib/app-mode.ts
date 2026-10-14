/**
 * The Android app (a TWA) and the pages it opens. Client-safe.
 *
 * Each launcher opens its dance with `?app=android`; the server keeps that as
 * a cookie, so server-rendered pages know they are inside the app and can hand
 * the native side work through `salsa://` links instead of file inputs. See
 * docs/superpowers/specs/2026-10-14-android-app-design.md.
 */
export const APP_COOKIE = 'salsa_app';
export const APP_PARAM = 'app';
export const APP_VALUE = 'android';
export const APP_SCHEME = 'salsa';

/** The key the app files a shared video under: a uuid it generated. */
export const SHARE_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Hands a lesson or a figure to the app's uploader; `share` picks a shared file instead of the picker. */
export function uploadLink(
	target: { lesson: number } | { figure: number },
	share?: string
): string {
	const params = new URLSearchParams(
		'lesson' in target ? { lesson: String(target.lesson) } : { figure: String(target.figure) }
	);
	if (share) params.set('share', share);
	return `${APP_SCHEME}://upload?${params}`;
}

/** Where `/device/pair` sends the fresh token: to the app, and nowhere else. */
export function pairedLink(token: string): string {
	return `${APP_SCHEME}://paired?token=${encodeURIComponent(token)}`;
}
