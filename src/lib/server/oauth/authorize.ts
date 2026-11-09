import { isChallenge } from './pkce';

export type AuthorizeRequest = {
	clientId: string;
	redirectUri: string;
	state: string | null;
	codeChallenge: string;
};
export type AuthorizeParse =
	| { kind: 'ok'; req: AuthorizeRequest }
	| { kind: 'fatal' }
	| {
			kind: 'redirect';
			req: Pick<AuthorizeRequest, 'redirectUri' | 'state'>;
			error: string;
			description: string;
	  };

/**
 * The shape of an authorization request. PURE.
 *
 * A missing client or redirect URI is FATAL: the page shows its own words, never
 * redirected, because there is nowhere trustworthy to redirect to. Whether the
 * client is allowed and the redirect URI is registered is checked after the
 * client document is fetched, and is fatal too. Everything else goes back to
 * the client as an RFC 6749 error.
 */
export function parseAuthorizeParams(params: URLSearchParams, resource: string): AuthorizeParse {
	const clientId = params.get('client_id') ?? '';
	const redirectUri = params.get('redirect_uri') ?? '';
	if (!clientId) return { kind: 'fatal' };
	if (!redirectUri) return { kind: 'fatal' };

	const state = params.get('state');
	const back = (error: string, description: string): AuthorizeParse => ({
		kind: 'redirect',
		req: { redirectUri, state },
		error,
		description
	});

	if (params.get('response_type') !== 'code')
		return back('unsupported_response_type', 'Only code is supported.');
	if (params.get('code_challenge_method') !== 'S256')
		return back('invalid_request', 'PKCE S256 is required.');
	const codeChallenge = params.get('code_challenge') ?? '';
	if (!isChallenge(codeChallenge)) return back('invalid_request', 'A code_challenge is required.');
	const target = params.get('resource');
	if (target !== null && target !== resource)
		return back('invalid_target', 'Tokens are only issued for this server.');

	return { kind: 'ok', req: { clientId, redirectUri, state, codeChallenge } };
}

/** The redirect back to the client, with `iss` (RFC 9207). */
export function backToClient(
	redirectUri: string,
	params: Record<string, string | null>,
	issuer: string
): string {
	const u = new URL(redirectUri);
	for (const [k, v] of Object.entries({ ...params, iss: issuer }))
		if (v !== null) u.searchParams.set(k, v);
	return u.toString();
}
