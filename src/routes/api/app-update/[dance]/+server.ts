import { error, json } from '@sveltejs/kit';
import { isDanceSlug } from '$lib/dances/dances';
import { currentRelease } from '$lib/server/releases';
import type { RequestHandler } from './$types';

/** Public: the newest release of a dance's app, or 404 when none is published. */
export const GET: RequestHandler = ({ params }) => {
	if (!isDanceSlug(params.dance)) error(404, 'Not found');
	const release = currentRelease(params.dance);
	if (!release) error(404, 'Not found');
	return json(
		{ ...release, url: `/releases/${params.dance}/${release.versionCode}.apk` },
		{ headers: { 'cache-control': 'no-cache' } }
	);
};
