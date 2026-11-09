import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { serverNow } from '$lib/server/server-clock';
import { push } from '$lib/server/sync/replay';
import { PUSH_BATCH, type CapturedRow, type PushRequest, type WireEntry } from '$lib/sync/outbox';

/** A browser database's key, and an entry's id: what `slotFor` and `sync_landed` key on. */
const KEY = /^[A-Za-z0-9-]{8,64}$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isRow = (v: unknown) =>
	v === null ||
	(isObj(v) &&
		Object.values(v).every((x) => x === null || typeof x === 'string' || typeof x === 'number'));

function readRow(v: unknown): CapturedRow | null {
	if (!isObj(v)) return null;
	if (typeof v.tbl !== 'string' || typeof v.key !== 'string') return null;
	if (v.op !== 'i' && v.op !== 'u' && v.op !== 'd') return null;
	if (!isRow(v.before) || !isRow(v.after)) return null;
	return v as CapturedRow;
}

function readEntry(v: unknown): WireEntry | null {
	if (!isObj(v)) return null;
	if (typeof v.id !== 'string' || !KEY.test(v.id)) return null;
	if (!isInt(v.madeAt) || !isInt(v.epoch)) return null;
	if (typeof v.url !== 'string' || !v.url.startsWith('/')) return null;
	if (typeof v.method !== 'string') return null;
	if (!Array.isArray(v.headers)) return null;
	for (const h of v.headers) {
		if (!Array.isArray(h) || h.length !== 2 || typeof h[0] !== 'string' || typeof h[1] !== 'string')
			return null;
	}
	if (v.body !== null && typeof v.body !== 'string') return null;
	if (!isObj(v.minted)) return null;
	for (const ids of Object.values(v.minted)) {
		if (!Array.isArray(ids) || !ids.every(isInt)) return null;
	}
	if (!Array.isArray(v.rows) || !v.rows.every((r) => readRow(r) !== null)) return null;
	return v as WireEntry;
}

function readPush(body: unknown): PushRequest | null {
	if (!isObj(body)) return null;
	if (typeof body.device !== 'string' || !KEY.test(body.device)) return null;
	if (typeof body.user !== 'string' || body.user === '') return null;
	if (!Array.isArray(body.entries) || body.entries.length > 2 * PUSH_BATCH) return null;
	const entries = body.entries.map(readEntry);
	if (entries.some((e) => e === null)) return null;
	return { device: body.device, user: body.user, entries: entries as WireEntry[] };
}

/**
 * The device's changes, replayed (offline phase 3). The cookie session only:
 * a paired phone's device token never pushes.
 */
export const POST: RequestHandler = async (event) => {
	const session = validateSession(event.cookies.get(SESSION_COOKIE));
	if (!session) return json({ message: 'Sign in' }, { status: 401 });
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ message: 'Bad request' }, { status: 400 });
	}
	const req = readPush(body);
	if (!req) return json({ message: 'Bad request' }, { status: 400 });
	// Another person's changes (the copy outlived their session): they wait for them.
	if (req.user !== session.userId) return json({ message: 'Sign in' }, { status: 409 });
	return json(
		await push(getDb(), (r) => event.fetch(r, { credentials: 'omit' }), session.userId, req, {
			now: serverNow(),
			origin: event.url.origin,
			// The replay's only session: the push's other cookies never fill in what an entry lacked.
			session: `${SESSION_COOKIE}=${event.cookies.get(SESSION_COOKIE)}`
		})
	);
};
