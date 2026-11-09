import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { pull } from '$lib/server/sync/pull';
import { THEME_COOKIE } from '$lib/theme/scheme';
import { APP_COOKIE } from '$lib/app-mode';
import { LOCALE_COOKIE } from '$lib/i18n/locale';
import type { PullRequest } from '$lib/sync/wire';

const ECHOED = [THEME_COOKIE, APP_COOKIE, LOCALE_COOKIE];

function readRequest(body: unknown): PullRequest | null {
	if (typeof body !== 'object' || body === null) return null;
	const b = body as Record<string, unknown>;
	if (typeof b.cursor !== 'number' || !Number.isInteger(b.cursor) || b.cursor < 0) return null;
	if (typeof b.schema !== 'string') return null;
	let digests: Record<string, string> | undefined;
	if (b.digests !== undefined) {
		if (typeof b.digests !== 'object' || b.digests === null || Array.isArray(b.digests))
			return null;
		for (const v of Object.values(b.digests)) if (typeof v !== 'string') return null;
		digests = b.digests as Record<string, string>;
	}
	if (b.userId !== undefined && b.userId !== null && typeof b.userId !== 'string') return null;
	return { cursor: b.cursor, schema: b.schema, digests, userId: b.userId };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// The cookie session only: a paired phone's device token never pulls.
	const session = validateSession(cookies.get(SESSION_COOKIE));
	if (!session) return json({ message: 'Sign in' }, { status: 401 });
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Bad request' }, { status: 400 });
	}
	const req = readRequest(body);
	if (!req) return json({ message: 'Bad request' }, { status: 400 });
	const out = pull(getDb(), session.userId, req);
	if ('refused' in out) return json(out, { status: 409 });
	for (const name of ECHOED) {
		const v = cookies.get(name);
		if (v !== undefined) out.cookies[name] = v;
	}
	return json(out);
};
