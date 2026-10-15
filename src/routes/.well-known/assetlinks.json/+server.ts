import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/** The Android app's application id. Must match `android/app/build.gradle.kts`. */
const PACKAGE = 'eu.anotherroot.salsa';

/**
 * Digital Asset Links: tells Chrome the Android app and this site are one
 * owner's, so the app opens it full screen (a TWA) rather than with Chrome's
 * URL bar. The signing key's SHA-256 fingerprint comes from the host's
 * `SALSA_ANDROID_CERT_SHA256` (comma-separated for several keys); unset, the
 * list is empty and the app still works, just with the bar showing.
 */
export const GET: RequestHandler = () => {
	const fingerprints = (env.SALSA_ANDROID_CERT_SHA256 ?? '')
		.split(',')
		.map((s) => s.trim().toUpperCase())
		.filter(Boolean);
	if (fingerprints.length === 0) return json([]);
	return json([
		{
			relation: ['delegate_permission/common.handle_all_urls'],
			target: {
				namespace: 'android_app',
				package_name: PACKAGE,
				sha256_cert_fingerprints: fingerprints
			}
		}
	]);
};
