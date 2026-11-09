import { isLoopback } from './redirect';

/**
 * Which AI clients may ask: any (the user's ruling, 2026-11-09), known either
 * by a Client ID Metadata Document at an https URL (Claude), or by a
 * registration (`register.ts`, other AI apps). The consent page shows the
 * client's host first, since a client can call itself anything.
 */

/** A client id that is a document URL: https with a path, no userinfo or fragment; loopback http only in dev. */
export function clientIdIsUrl(clientId: string, devLoopback: boolean): boolean {
	let u: URL;
	try {
		u = new URL(clientId);
	} catch {
		return false;
	}
	if (u.hash || u.username || u.password) return false;
	if (u.pathname === '/' || u.pathname === '') return false;
	if (u.protocol === 'https:') return true;
	return devLoopback && isLoopback(u);
}

export interface ClientDocument {
	clientId: string;
	/** Self-asserted. Shown second, after the host. */
	clientName: string | null;
	redirectUris: string[];
}

const MAX_NAME = 100;

/** A client's own name, or null when missing, blank or too long. */
export function clientNameOf(name: unknown): string | null {
	return typeof name === 'string' && name.trim() && name.trim().length <= MAX_NAME
		? name.trim()
		: null;
}

/** A Client ID Metadata Document, checked for what this server relies on. */
export function parseClientDocument(
	clientId: string,
	json: unknown
): { ok: true; doc: ClientDocument } | { ok: false; reason: string } {
	if (!json || typeof json !== 'object' || Array.isArray(json))
		return { ok: false, reason: 'not an object' };
	const d = json as Record<string, unknown>;
	if (d.client_id !== clientId)
		return { ok: false, reason: 'client_id does not name the document' };
	const uris = d.redirect_uris;
	if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === 'string')) {
		return { ok: false, reason: 'no redirect_uris' };
	}
	const method = d.token_endpoint_auth_method;
	if (method !== undefined && method !== 'none')
		return { ok: false, reason: 'not a public client' };
	return {
		ok: true,
		doc: { clientId, clientName: clientNameOf(d.client_name), redirectUris: uris as string[] }
	};
}
