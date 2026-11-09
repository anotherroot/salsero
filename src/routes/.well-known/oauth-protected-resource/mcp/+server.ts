import { json } from '@sveltejs/kit';
import { protectedResourceMetadata } from '$lib/server/oauth/metadata';
import type { RequestHandler } from './$types';

/** RFC 9728, at the path-suffixed form Claude tries first. */
export const GET: RequestHandler = ({ url }) =>
	json(protectedResourceMetadata(url.origin), { headers: { 'cache-control': 'no-store' } });
