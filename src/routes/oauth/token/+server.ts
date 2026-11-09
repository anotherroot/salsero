import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tokenFailures } from '$lib/server/oauth/limits';
import { mcpResource } from '$lib/server/oauth/metadata';
import { exchangeCode, refresh } from '$lib/server/oauth/store';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store', pragma: 'no-cache' };
const oauthError = (status: number, error: string, description: string) =>
	json({ error, error_description: description }, { status, headers: NO_STORE });

/**
 * The token endpoint. Reached WITHOUT an Origin, form-encoded: the one path the
 * hook's form check exempts (`src/lib/server/csrf.ts`). It holds no cookie
 * authority: everything rests on the code + PKCE verifier, or the refresh
 * token, in the body.
 *
 * The limit never refuses a request that would succeed: the exchange runs
 * first, and only a FAILURE meets it. AI apps call from shared addresses, so a
 * limit checked up front would let a stranger's junk switch them off.
 */
export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const ip = getClientAddress();
	const type = (request.headers.get('content-type') ?? '').toLowerCase();
	if (!type.startsWith('application/x-www-form-urlencoded'))
		return oauthError(400, 'invalid_request', 'Send application/x-www-form-urlencoded.');
	const form = await request.formData();
	const get = (k: string) => {
		const v = form.get(k);
		return typeof v === 'string' ? v : '';
	};
	const clientId = get('client_id');
	if (!clientId) return oauthError(400, 'invalid_client', 'client_id is required.');
	const resource = form.get('resource');
	if (resource !== null && resource !== mcpResource(url.origin))
		return oauthError(400, 'invalid_target', 'Tokens are only issued for this server.');

	const db = getDb();
	const now = serverNow();
	let out: ReturnType<typeof exchangeCode>;
	switch (get('grant_type')) {
		case 'authorization_code':
			out = exchangeCode(
				db,
				{
					code: get('code'),
					verifier: get('code_verifier'),
					redirectUri: get('redirect_uri'),
					clientId
				},
				now
			);
			break;
		case 'refresh_token':
			out = refresh(db, { refreshToken: get('refresh_token'), clientId }, now);
			break;
		default:
			return oauthError(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.');
	}
	if ('error' in out) {
		if (tokenFailures.over(ip, now))
			return oauthError(429, 'invalid_request', 'Too many failed requests. Wait 15 minutes.');
		tokenFailures.count(ip, now);
		return oauthError(400, out.error, out.description);
	}
	return json(out, { headers: NO_STORE });
};
