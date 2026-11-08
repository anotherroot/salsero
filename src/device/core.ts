/*
 * The device worker's logic (offline phase 2), apart from the browser: the
 * copy's start, the pull and the answering. worker.ts gives it the real
 * SQLite, `fetch` and SvelteKit's `Server`; specs give it better-sqlite3 and
 * fakes. Read only: it answers GETs and nothing else.
 */
import { isDanceSlug } from '$lib/dances/dances';
import { deviceAnswers } from '$lib/offline/routes';
import type {
	DeviceOut,
	DeviceState,
	WireFallback,
	WireRequest,
	WireResponse
} from '$lib/offline/protocol';
import type { PullResponse } from '$lib/sync/wire';
import { applyPull, pullRequestOf, wipeCopy } from './apply';
import { readMeta, type SqliteDb } from './migrate';
import { DeviceRequest } from './request';

/** What the server code reads to know it runs on the device (`$lib/server/device-runtime`). */
export type DeviceRuntime = { userId: string; cookies: Record<string, string> };

/** SvelteKit's `server.respond`, bound to the device's client address. */
export type Responder = (request: Request) => Promise<Response>;

export type DeviceDeps = {
	/** The worker's own connection to the copy, migrated. */
	db: SqliteDb;
	/** The schema this bundle was built with (`SCHEMA_TAG`). */
	schema: string;
	/** POSTs a pull request body to the server; rejects when the network fails. */
	fetchPull: (body: string) => Promise<Response>;
	/** Builds SvelteKit's `Server` over the copy; called once, after the runtime is set. */
	startServer: () => Promise<Responder>;
	/** Sets `globalThis.__salsaDevice`. */
	setRuntime: (runtime: DeviceRuntime) => void;
	post: (message: DeviceOut) => void;
	online: () => boolean;
	userAgent: string;
	log: Pick<Console, 'info' | 'warn' | 'error'>;
	/** The wall clock the page shares: a `pulled` says when its request left (`startedAt`). */
	now: () => number;
};

export type Device = {
	/** Inside the lock: the first pull when there is no copy, then the server. */
	start(): Promise<void>;
	/** At most one pull at a time; asking during one queues exactly one more. */
	pull(): Promise<void>;
	answer(request: WireRequest): Promise<WireResponse | WireFallback>;
	state(): DeviceState | null;
};

/**
 * `task` run at most once at a time. A call while it runs queues one more run
 * after it (however many calls come), and resolves when that run ends.
 */
export function oneAtATime(task: () => Promise<void>): () => Promise<void> {
	let running: Promise<void> | null = null;
	let queued: Promise<void> | null = null;
	const trigger = (): Promise<void> => {
		if (!running) {
			running = task().finally(() => {
				running = null;
			});
			return running;
		}
		const next = () => {
			queued = null;
			return trigger();
		};
		queued ??= running.then(next, next);
		return queued;
	};
	return trigger;
}

/** The headers a request on the device carries: the page's, the copy's cookies, the browser's agent. */
export function deviceHeaders(
	wire: [string, string][],
	cookies: Record<string, string>,
	userAgent: string
): Headers {
	const h = new Headers(wire);
	const jar = Object.entries(cookies)
		.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
		.join('; ');
	if (jar) h.set('cookie', jar);
	else h.delete('cookie');
	h.set('user-agent', userAgent);
	return h;
}

/** Whether the copy holds its person as the hook needs them (`deviceUser`): a row with a dance. */
export function copyHasUser(db: SqliteDb, userId: string): boolean {
	const row = db.prepare('SELECT dance FROM users WHERE id = ?').get(userId) as
		{ dance: string | null } | undefined;
	return !!row?.dance && isDanceSlug(row.dance);
}

const fallback = (reason: string): WireFallback => ({ fallback: true, reason });

export function createDevice(deps: DeviceDeps): Device {
	const { db, log } = deps;
	let state: DeviceState | null = null;
	let runtime: DeviceRuntime | null = null;
	let respond: Responder | null = null;
	let serverStart: Promise<void> | null = null;

	const setState = (next: DeviceState) => {
		if (state === next) return;
		state = next;
		deps.post({ type: 'state', state: next });
	};

	const hasCopy = () => readMeta(db).userId !== null;

	/** The runtime from the copy's meta; the server once; then `ready`. */
	async function serve(): Promise<void> {
		const meta = readMeta(db);
		if (meta.userId === null) throw new Error('serve() with no copy');
		// One object, updated in place: the server reads it on every request.
		if (runtime) Object.assign(runtime, { userId: meta.userId, cookies: meta.cookies });
		else deps.setRuntime((runtime = { userId: meta.userId, cookies: meta.cookies }));
		serverStart ??= deps.startServer().then(
			(r) => {
				respond = r;
			},
			(e) => {
				// The next pull tries again.
				serverStart = null;
				throw e;
			}
		);
		await serverStart;
		// A pull may have found the person signed out while the server started.
		setState(hasCopy() ? 'ready' : 'empty');
	}

	async function pullOnce(): Promise<'again' | 'done'> {
		let res: Response;
		// Taken just before the request leaves: a write the server took before
		// this instant is in the answer (the page's `pullCovers`).
		let startedAt: number;
		try {
			const request = JSON.stringify(await pullRequestOf(db, deps.schema));
			startedAt = deps.now();
			res = await deps.fetchPull(request);
		} catch (e) {
			log.warn('[device] pull: no network, the copy stays', String(e));
			return 'done';
		}
		if (res.status === 401) {
			// Signed out means no copy (phase 3 revisits this once there is an outbox).
			wipeCopy(db);
			setState('empty');
			log.info('[device] signed out: the copy is wiped');
			return 'done';
		}
		if (res.status === 409) {
			log.warn('[device] schema behind, waiting for the update');
			return 'done';
		}
		if (!res.ok) {
			log.warn(`[device] pull: the server answered ${res.status}, the copy stays`);
			return 'done';
		}
		let body: PullResponse;
		try {
			body = (await res.json()) as PullResponse;
		} catch (e) {
			log.warn('[device] pull: the answer did not arrive whole, the copy stays', String(e));
			return 'done';
		}
		try {
			applyPull(db, body);
		} catch (e) {
			// applyPull has asked for a full pull next (meta full = '1').
			log.error('[device] pull: applying failed', e);
			return 'again';
		}
		await serve();
		deps.post({ type: 'pulled', cursor: body.cursor, startedAt });
		return 'done';
	}

	const pull = oneAtATime(async () => {
		try {
			// A failed apply pulls once more at once, a full pull; a second failure waits for the next ask.
			if ((await pullOnce()) === 'again' && (await pullOnce()) === 'again') {
				log.error('[device] pull: applying failed twice, waiting for the next pull');
			}
		} catch (e) {
			// The server would not start, or the database itself fails.
			log.error('[device] pull failed', e);
			if (state !== 'ready') setState('failed');
		}
	});

	return {
		async start() {
			setState('starting');
			try {
				if (deps.online()) {
					const pulled = pull();
					if (!hasCopy()) await pulled;
				}
				if (hasCopy()) await serve();
				else setState('empty');
			} catch (e) {
				log.error('[device] start failed', e);
				setState('failed');
			}
		},

		pull,

		async answer(wire) {
			if (state !== 'ready' || !respond || !runtime) return fallback(`device ${state ?? 'off'}`);
			try {
				const url = new URL(wire.url);
				if (!deviceAnswers(wire.method, url)) return fallback('the network answers this');
				// Without its person the hook would send the page to sign in, a network page.
				if (!copyHasUser(db, runtime.userId)) return fallback('the copy has no user');
				const res = await respond(
					new DeviceRequest(
						url,
						{ method: wire.method },
						deviceHeaders(wire.headers, runtime.cookies, deps.userAgent)
					)
				);
				return { status: res.status, headers: [...res.headers], body: await res.arrayBuffer() };
			} catch (e) {
				log.error('[device] answering failed', wire.url, e);
				return fallback(String(e));
			}
		},

		state: () => state
	};
}
