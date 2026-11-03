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
	if (res.status === 200 || res.status === 206) {
		res.headers.set('cache-control', 'public, max-age=31536000, immutable');
	}
	return res;
};
