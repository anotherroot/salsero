import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { oauthClients } from '../db/schema';
import { clientIdIsUrl, clientNameOf, type ClientDocument } from './client';
import { fetchClientDocument, type Fetcher } from './fetch-client';
import { isLoopback } from './redirect';

/**
 * Dynamic client registration (RFC 7591), for AI apps that do not publish a
 * Client ID Metadata Document. Public clients only (no secret); the row holds
 * nothing but the name and the exact redirect URIs. Rate limited by the route.
 */

const PREFIX = 'sa_client_';
const MAX_URIS = 10;
const MAX_URI = 2000;
const GRANTS = ['authorization_code', 'refresh_token'];

type Refusal = {
	ok: false;
	error: 'invalid_redirect_uri' | 'invalid_client_metadata';
	description: string;
};

function redirectUriOk(s: unknown): boolean {
	if (typeof s !== 'string' || s.length > MAX_URI) return false;
	let u: URL;
	try {
		u = new URL(s);
	} catch {
		return false;
	}
	if (u.hash || u.username || u.password) return false;
	return u.protocol === 'https:' || isLoopback(u);
}

export function registerClient(
	db: Db,
	body: unknown,
	now: number
): { ok: true; response: Record<string, unknown> } | Refusal {
	const meta = (description: string): Refusal => ({
		ok: false,
		error: 'invalid_client_metadata',
		description
	});
	if (!body || typeof body !== 'object' || Array.isArray(body)) return meta('Send a JSON object.');
	const b = body as Record<string, unknown>;
	const uris = b.redirect_uris;
	if (
		!Array.isArray(uris) ||
		uris.length === 0 ||
		uris.length > MAX_URIS ||
		!uris.every(redirectUriOk)
	) {
		return {
			ok: false,
			error: 'invalid_redirect_uri',
			description: `1 to ${MAX_URIS} https (or loopback http) redirect URIs, no fragment.`
		};
	}
	const method = b.token_endpoint_auth_method;
	if (method !== undefined && method !== 'none')
		return meta('Only public clients: token_endpoint_auth_method must be "none".');
	const grants = b.grant_types ?? ['authorization_code'];
	if (!Array.isArray(grants) || !grants.every((g) => GRANTS.includes(g as string)))
		return meta('grant_types may hold only authorization_code and refresh_token.');

	const clientId = PREFIX + randomBytes(16).toString('hex');
	const clientName = clientNameOf(b.client_name);
	db.insert(oauthClients)
		.values({ clientId, clientName, redirectUris: JSON.stringify(uris), createdAt: now })
		.run();
	return {
		ok: true,
		response: {
			client_id: clientId,
			client_id_issued_at: Math.floor(now / 1000),
			client_name: clientName,
			redirect_uris: uris,
			token_endpoint_auth_method: 'none',
			grant_types: grants,
			response_types: ['code']
		}
	};
}

const hostOf = (url: string) => {
	try {
		return new URL(url).host;
	} catch {
		return '';
	}
};

/**
 * Who is asking: a registered client from its row, a document client fetched.
 * `host` is what the consent page shows first: the document's host, or for a
 * registered client the host its codes go to.
 */
export async function resolveClient(
	db: Db,
	clientId: string,
	allowLoopback: boolean,
	fetcher?: Fetcher
): Promise<{ ok: true; doc: ClientDocument; host: string } | { ok: false; reason: string }> {
	if (clientId.startsWith(PREFIX)) {
		const row = db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).get();
		if (!row) return { ok: false, reason: 'unknown client' };
		const redirectUris = JSON.parse(row.redirectUris) as string[];
		return {
			ok: true,
			doc: { clientId, clientName: row.clientName, redirectUris },
			host: hostOf(redirectUris[0])
		};
	}
	if (!clientIdIsUrl(clientId, allowLoopback)) return { ok: false, reason: 'client id is no URL' };
	const got = await fetchClientDocument(clientId, allowLoopback, fetcher);
	return got.ok ? { ok: true, doc: got.doc, host: hostOf(clientId) } : got;
}

/** The host shown for a grant's client in Settings: the same rule as `resolveClient`. */
export function clientHost(clientId: string, redirectUri: string): string {
	return clientId.startsWith(PREFIX) ? hostOf(redirectUri) : hostOf(clientId);
}
