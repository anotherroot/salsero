import { error } from '@sveltejs/kit';
import { isDanceSlug } from '$lib/dances/dances';
import { releasesDir, serveFile } from '$lib/server/files';
import { apkPath } from '$lib/server/releases';
import type { RequestHandler } from './$types';

/** Public: a published APK, by version code. Immutable, so cached for a year. */
export const GET: RequestHandler = async ({ params, request }) => {
	const m = /^(\d+)\.apk$/.exec(params.file);
	if (!isDanceSlug(params.dance) || !m) error(404, 'Not found');
	const res = await serveFile(
		apkPath(releasesDir(), params.dance, Number(m[1])),
		'application/vnd.android.package-archive',
		request
	);
	// A miss is never cached: Cloudflare would keep a 404 asked for just before
	// a release, and the file would stay "missing" after it is published.
	res.headers.set(
		'cache-control',
		res.status === 200 || res.status === 206 ? 'public, max-age=31536000, immutable' : 'no-store'
	);
	return res;
};
