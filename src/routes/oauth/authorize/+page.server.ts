import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { danceHosts } from '$lib/server/hosts';
import { hostDance } from '$lib/dances/hosts';
import { DANCES } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import { approve } from '$lib/server/oauth/store';
import { backToClient, parseAuthorizeParams } from '$lib/server/oauth/authorize';
import { mcpResource } from '$lib/server/oauth/metadata';
import { isLoopback, redirectMatches } from '$lib/server/oauth/redirect';
import { clientHost, resolveClient } from '$lib/server/oauth/register';
import { serverNow } from '$lib/server/server-clock';
import type { Actions, PageServerLoad } from './$types';

/**
 * The consent page of the AI connector (docs/superpowers/specs/2026-11-09-ai-connector-design.md).
 * Behind the session like any page: signed out, the hook's login redirect brings
 * the person back. Every check runs on the GET and again on the POST; the POST
 * carries the parameters as hidden fields and `as`, which must be the session's
 * person. Never framed.
 */

const FRAME_DENY = {
	'x-frame-options': 'DENY',
	'content-security-policy': "frame-ancestors 'none'"
};

/** The parameters the page carries from the GET to the POST. */
const CARRIED = [
	'response_type',
	'client_id',
	'redirect_uri',
	'code_challenge',
	'code_challenge_method',
	'state',
	'resource'
] as const;

type Checked =
	| { kind: 'bad' }
	| { kind: 'back'; to: string }
	| {
			kind: 'ok';
			host: string;
			name: string | null;
			clientId: string;
			redirectUri: string;
			state: string | null;
			codeChallenge: string;
	  };

/**
 * The request, the client and its redirect URI. Nothing is sent back to the
 * client until the redirect URI is known to be one it registered.
 */
async function check(params: URLSearchParams, url: URL): Promise<Checked> {
	const parsed = parseAuthorizeParams(params, mcpResource(url.origin));
	if (parsed.kind === 'fatal') return { kind: 'bad' };
	const clientId = params.get('client_id') ?? '';
	const client = await resolveClient(getDb(), clientId, isLoopback(url));
	if (!client.ok) return { kind: 'bad' };
	const redirectUri = parsed.req.redirectUri;
	if (!redirectMatches(redirectUri, client.doc.redirectUris)) return { kind: 'bad' };
	if (parsed.kind === 'redirect')
		return {
			kind: 'back',
			to: backToClient(
				redirectUri,
				{ error: parsed.error, error_description: parsed.description, state: parsed.req.state },
				url.origin
			)
		};
	return {
		kind: 'ok',
		// The host the code goes to for a registered client (it may list several), else the document's.
		host: clientHost(clientId, redirectUri),
		name: client.doc.clientName,
		clientId,
		redirectUri,
		state: parsed.req.state,
		codeChallenge: parsed.req.codeChallenge
	};
}

/** The host's dance when the account is another dance's (a mapped host only). */
function otherDance(url: URL, userDance: string): string | null {
	const here = hostDance(danceHosts(), url.host);
	return here && here !== userDance ? DANCES[here].label : null;
}

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	setHeaders(FRAME_DENY);
	const user = locals.user!;
	const other = otherDance(url, user.dance);
	if (other) return { kind: 'otherDance' as const, dance: other };
	const c = await check(url.searchParams, url);
	if (c.kind === 'back') redirect(303, c.to);
	if (c.kind === 'bad') return { kind: 'bad' as const };
	const carried = Object.fromEntries(
		CARRIED.flatMap((k) => {
			const v = url.searchParams.get(k);
			return v === null ? [] : [[k, v]];
		})
	);
	return {
		kind: 'ask' as const,
		host: c.host,
		name: c.name && c.name !== c.host ? c.name : null,
		as: user.id,
		carried
	};
};

/** The POST's own checks; answers the checked request, or throws. */
async function checkPost(event: Parameters<Actions['approve']>[0]) {
	event.setHeaders(FRAME_DENY);
	const user = event.locals.user!;
	const form = await event.request.formData();
	if (form.get('as') !== user.id || otherDance(event.url, user.dance))
		error(403, t().settings.connector.badRequest);
	const params = new URLSearchParams();
	for (const k of CARRIED) {
		const v = form.get(k);
		if (typeof v === 'string') params.set(k, v);
	}
	const c = await check(params, event.url);
	if (c.kind === 'back') redirect(303, c.to);
	if (c.kind === 'bad') error(400, t().settings.connector.badRequest);
	return { user, c };
}

export const actions: Actions = {
	approve: async (event) => {
		const { user, c } = await checkPost(event);
		const code = approve(
			getDb(),
			{
				userId: user.id,
				clientId: c.clientId,
				clientName: c.name,
				redirectUri: c.redirectUri,
				codeChallenge: c.codeChallenge
			},
			serverNow()
		);
		redirect(303, backToClient(c.redirectUri, { code, state: c.state }, event.url.origin));
	},
	cancel: async (event) => {
		const { c } = await checkPost(event);
		redirect(
			303,
			backToClient(c.redirectUri, { error: 'access_denied', state: c.state }, event.url.origin)
		);
	}
};
