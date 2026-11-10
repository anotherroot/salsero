import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { pull } from '$lib/server/sync/pull';
import { serverExtras } from '$lib/server/sync/extras';
import { THEME_COOKIE, THEME_COOKIE_OPTIONS, isThemeChoice } from '$lib/theme/scheme';
import { APP_COOKIE } from '$lib/app-mode';
import { LOCALE_COOKIE } from '$lib/i18n/locale';
import type { PullRequest } from '$lib/sync/wire';

/** A browser database's key (offline phase 3): what `slotFor` keys a slot on. */
const DEVICE_KEY = /^[A-Za-z0-9-]{8,64}$/;

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
	if (b.device !== undefined && (typeof b.device !== 'string' || !DEVICE_KEY.test(b.device)))
		return null;
	return { cursor: b.cursor, schema: b.schema, digests, userId: b.userId, device: b.device };
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
	const out = pull(getDb(), session.userId, req, request.headers.get('user-agent') ?? undefined);
	if ('refused' in out) return json(out, { status: 409 });
	for (const name of ECHOED) {
		const v = cookies.get(name);
		if (v !== undefined) out.cookies[name] = v;
	}
	// Set again, readable by app.html's script: one set before 2026-11-10 was
	// `httpOnly`, and a page drawn from the shell could not see it (dark on a dark phone).
	const theme = cookies.get(THEME_COOKIE);
	if (isThemeChoice(theme)) cookies.set(THEME_COOKIE, theme, THEME_COOKIE_OPTIONS);
	// What the layouts drawn on the device cannot read from the copy (device first).
	out.extras = serverExtras(getDb(), session.userId);
	return json(out);
};
