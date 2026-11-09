import { json } from '@sveltejs/kit';
import { authorizationServerMetadata } from '$lib/server/oauth/metadata';
import type { RequestHandler } from './$types';

/** RFC 8414. The issuer is the host asked: salsa and bachata are each their own. */
export const GET: RequestHandler = ({ url }) =>
	json(authorizationServerMetadata(url.origin), { headers: { 'cache-control': 'no-store' } });
