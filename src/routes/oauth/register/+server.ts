import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { readCapped, registrations } from '$lib/server/oauth/limits';
import { registerClient } from '$lib/server/oauth/register';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Dynamic client registration (RFC 7591) for AI apps without a metadata
 * document. JSON, no cookie, no Origin: a registration grants nothing until a
 * person approves it on the consent page. Machines read this: English.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const now = serverNow();
	const ip = getClientAddress();
	if (registrations.over(ip, now))
		return json(
			{ error: 'invalid_request', error_description: 'Too many registrations. Wait an hour.' },
			{ status: 429, headers: NO_STORE }
		);
	const text = await readCapped(request);
	if (text === null)
		return json(
			{ error: 'invalid_client_metadata', error_description: 'The body is too large.' },
			{ status: 413, headers: NO_STORE }
		);
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		body = null;
	}
	registrations.count(ip, now);
	const r = registerClient(getDb(), body, now);
	if (!r.ok)
		return json(
			{ error: r.error, error_description: r.description },
			{ status: 400, headers: NO_STORE }
		);
	return json(r.response, { status: 201, headers: NO_STORE });
};
