/*
 * The device worker's logic (offline phase 2), apart from the browser: the
 * copy's start, the pull and the answering. worker.ts gives it the real
 * SQLite, `fetch` and SvelteKit's `Server`; specs give it better-sqlite3 and
 * fakes. Reads answer from the copy; since offline phase 3 a device-first
 * write runs here too, in one transaction with its capture, and goes in the
 * outbox.
 */
import { isDanceSlug } from '$lib/dances/dances';
import { deviceAnswers, writeClass } from '$lib/offline/routes';
import { OWNERS, ownerOf } from '$lib/sync/owners';
import {
	OUTBOX_HEADER,
	RECORDED_HEADERS,
	entryLabel,
	mintedIn,
	type CapturedRow
} from '$lib/sync/outbox';
import { installCapture, startCapture, stopCapture } from './capture';
import {
	applyResults,
	discardEntry,
	resolveEntry,
	forgetPerson,
	outboxItems,
	outboxSummary,
	recordEntry,
	resetSending,
	retryEntry,
	setStates,
	toSend,
	toWire
} from './outbox';
import type {
	DeviceOut,
	DeviceState,
	OutboxItem,
	OutboxSummary,
	WireFallback,
	WireRequest,
	WireResponse
} from '$lib/offline/protocol';
import type { PushResponse } from '$lib/sync/outbox';
import type { PullResponse } from '$lib/sync/wire';
import { applyPull, ensureDeviceKey, pullRequestOf, wipeCopy } from './apply';
import { readMeta, writeMetaValue, type SqliteDb } from './migrate';
import { DeviceRequest } from './request';

/** What the server code reads to know it runs on the device (`$lib/server/device-runtime`). */
export type DeviceRuntime = {
	userId: string;
	cookies: Record<string, string>;
	/** The id slot new rows are minted in (offline phase 3); null until the server hands one out. */
	slot: number | null;
};

/** SvelteKit's `server.respond`, bound to the device's client address. */
export type Responder = (request: Request) => Promise<Response>;

export type DeviceDeps = {
	/** The worker's own connection to the copy, migrated. */
	db: SqliteDb;
	/** The schema this bundle was built with (`SCHEMA_TAG`). */
	schema: string;
	/** POSTs a pull request body to the server; rejects when the network fails. */
	fetchPull: (body: string) => Promise<Response>;
	/** POSTs the outbox's entries to /api/sync/push; rejects when the network fails. */
	fetchPush: (body: string) => Promise<Response>;
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
	/** The build's `PAGE_EPOCH`: a page of another build writes through the network. */
	epoch: number;
	/** A new outbox entry's id (`crypto.randomUUID`). */
	newId: () => string;
	/** A write went in the outbox: the worker posts the summary and pushes soon. */
	onRecorded: () => void;
};

export type Device = {
	/** Inside the lock: the first pull when there is no copy, then the server. */
	start(): Promise<void>;
	/** At most one sync at a time; asking during one queues exactly one more. */
	pull(): Promise<void>;
	/** Push the outbox, then pull once nothing waits (offline phase 3). */
	sync(): Promise<SyncResult>;
	summary(): OutboxSummary;
	outboxList(): Promise<OutboxItem[]>;
	/** A refused entry and those held by it wait again; then a sync. How many. */
	retry(id: string): Promise<number>;
	/** A refused entry and those held by it are dropped; then a sync restores the server's state. How many. */
	discard(id: string): Promise<number>;
	/** A clash settled (Mine landed, or Theirs kept): only that entry goes, its held ones wait again; then a sync. */
	resolve(id: string): Promise<number>;
	/** Sign out, confirmed: the copy and this person's entries go. */
	forget(): Promise<void>;
	/**
	 * Who the page says is signed in, from the server's own answer: null wipes
	 * the copy (signed out); another person than the copy's wipes it and pulls
	 * theirs, and the copy answers nothing until it lands. Before `start` it is
	 * only noted, and `start` honours it.
	 */
	person(userId: string | null): Promise<void>;
	/**
	 * `person`: the asking page's, when it knows (undefined: not yet, as on the
	 * offline shell). A page of anyone but the copy's person gets a fallback.
	 */
	answer(request: WireRequest, person?: string | null): Promise<WireResponse | WireFallback>;
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
	userAgent: string,
	origin?: string
): Headers {
	const h = new Headers(wire);
	// SvelteKit refuses a form post from another origin: a write here is the site's own.
	if (origin) h.set('origin', origin);
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

const q = (name: string) => `"${name.replaceAll('"', '""')}"`;
const rowById = (db: SqliteDb, table: string, id: number) =>
	(db.prepare(`SELECT * FROM ${q(table)} WHERE id = ?`).get(id) as
		Record<string, unknown> | undefined) ?? null;
const nameOf = (row: Record<string, unknown> | null | undefined): string | null => {
	for (const c of ['name', 'title', 'label']) {
		const v = row?.[c];
		if (typeof v === 'string' && v.trim()) return v;
	}
	return null;
};

/** What the Sync page names an entry by: a log's drill, else the row it changed, else that row's parent. */
export function thingName(db: SqliteDb, action: string, rows: CapturedRow[]): string | null {
	const sideOf = (r: CapturedRow) => (r.after ?? r.before ?? {}) as Record<string, unknown>;
	if (action === 'done') {
		const set = rows.find((r) => r.tbl === 'sets');
		const ex = set ? sideOf(set).exercise_id : undefined;
		return typeof ex === 'number' ? nameOf(rowById(db, 'exercises', ex)) : null;
	}
	for (const r of rows) {
		const own = nameOf(sideOf(r));
		if (own) return own;
		const rule = OWNERS[r.tbl];
		if (!rule || !('via' in rule)) continue;
		for (const { col, table } of rule.via) {
			const id = sideOf(r)[col];
			if (typeof id !== 'number') continue;
			const parent = nameOf(rowById(db, table, id));
			if (parent) return parent;
		}
	}
	return null;
}

/** An action's answer (`x-sveltekit-action`): its JSON `type` and status. */
function actionOutcome(bytes: ArrayBuffer): { type: string | null } {
	try {
		const body = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown };
		return { type: typeof body.type === 'string' ? body.type : null };
	} catch {
		return { type: null };
	}
}

export type SyncResult = 'synced' | 'waiting' | 'offline' | 'signed-out';

export function createDevice(deps: DeviceDeps): Device {
	const { db, log } = deps;
	let state: DeviceState | null = null;
	let runtime: DeviceRuntime | null = null;
	let respond: Responder | null = null;
	let serverStart: Promise<void> | null = null;
	/** The page's person (`person`); undefined until a page says. */
	let wanted: string | null | undefined = undefined;
	/** Bumped by every `person`: a later one decides the state, not an older one finishing. */
	let switches = 0;
	let started = false;
	/** Writes, and the pull's apply, one at a time: a write's capture never mixes with another's. */
	let lane: Promise<unknown> = Promise.resolve();
	function exclusive<T>(fn: () => Promise<T>): Promise<T> {
		const run = lane.then(fn, fn);
		lane = run.catch(() => {});
		return run;
	}

	const setState = (next: DeviceState) => {
		if (state === next) return;
		state = next;
		deps.post({ type: 'state', state: next });
	};

	const copyUser = () => readMeta(db).userId;
	/** The copy may answer: it holds someone, and the page's person once a page has said. */
	const copyFits = () => {
		const user = copyUser();
		return user !== null && (wanted === undefined || user === wanted);
	};
	/**
	 * The copy goes when it is another person's (offline phase 3: never for a
	 * signed-out page, since the copy may hold changes still on their way; the
	 * outbox keeps the first person's entries for them either way).
	 */
	const wipeOther = () => {
		const user = copyUser();
		if (user === null || wanted === undefined || wanted === null || user === wanted) return;
		wipeCopy(db);
		log.info('[device] another person: the copy is wiped, theirs is pulled');
	};
	const postSummary = () => deps.post({ type: 'outbox', summary: outboxSummary(db, copyUser()) });

	/** The runtime from the copy's meta; the server once; then `ready`. */
	async function serve(): Promise<void> {
		const meta = readMeta(db);
		if (meta.userId === null) throw new Error('serve() with no copy');
		// One object, updated in place: the server reads it on every request.
		if (runtime)
			Object.assign(runtime, { userId: meta.userId, cookies: meta.cookies, slot: meta.slot });
		else
			deps.setRuntime((runtime = { userId: meta.userId, cookies: meta.cookies, slot: meta.slot }));
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
		// A pull may have found the person signed out, or a page another person, while the server started.
		setState(copyFits() ? 'ready' : 'empty');
	}

	async function pullOnce(): Promise<'again' | 'done' | 'dropped' | 'signed-out'> {
		let res: Response;
		// Taken just before the request leaves: a write the server took before
		// this instant is in the answer (the page's `pullCovers`).
		let startedAt: number;
		const seqBefore = outboxSummary(db, copyUser()).seq;
		try {
			const request = JSON.stringify(await pullRequestOf(db, deps.schema));
			startedAt = deps.now();
			res = await deps.fetchPull(request);
		} catch (e) {
			log.warn('[device] pull: no network, the copy stays', String(e));
			return 'done';
		}
		if (res.status === 401) {
			// Signed out (an expired session): the copy and the outbox stay, the page says sign in.
			writeMetaValue(db, 'signedOut', '1');
			postSummary();
			log.info('[device] pull: signed out, the copy stays');
			return 'signed-out';
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
		if (wanted !== undefined && body.userId !== wanted) {
			// Asked before the page said who it is (or signed in again since): not theirs.
			log.warn("[device] pull: the answer is not the page's person's, not taken");
			return 'done';
		}
		try {
			const applied = await exclusive(async () => {
				// A write recorded while the answer was on its way is not in it: applying would erase it.
				const sum = outboxSummary(db, copyUser());
				if (sum.seq !== seqBefore || sum.waiting > 0) return false;
				applyPull(db, body);
				writeMetaValue(db, 'signedOut', '0');
				writeMetaValue(db, 'lastSyncedAt', String(deps.now()));
				return true;
			});
			if (!applied) {
				log.info('[device] pull: a change was made meanwhile, the answer is dropped');
				return 'dropped';
			}
		} catch (e) {
			// applyPull has asked for a full pull next (meta full = '1').
			log.error('[device] pull: applying failed', e);
			return 'again';
		}
		await serve();
		postSummary();
		deps.post({ type: 'pulled', cursor: body.cursor, startedAt, landed: lastLanded });
		lastLanded = 0;
		return 'done';
	}

	/** How many entries landed since the last `pulled` was posted. */
	let lastLanded = 0;

	/** Sends what waits, batch by batch, until nothing waits or the server can't be reached. */
	async function pushAll(): Promise<SyncResult | 'pushed'> {
		const meta = readMeta(db);
		const user = meta.userId;
		if (user === null || meta.deviceKey === null) return 'pushed';
		for (;;) {
			const rows = await exclusive(async () => {
				const next = toSend(db, user);
				setStates(
					db,
					next.map((r) => r.id),
					'sending'
				);
				return next;
			});
			if (rows.length === 0) return 'pushed';
			let res: Response;
			try {
				res = await deps.fetchPush(
					JSON.stringify({ device: meta.deviceKey, user, entries: rows.map(toWire) })
				);
			} catch (e) {
				resetSending(db);
				postSummary();
				log.warn('[device] push: no network, the changes wait', String(e));
				return 'offline';
			}
			// 409: the browser is signed in as someone else; theirs wait for their own person.
			if (res.status === 401 || res.status === 409) {
				resetSending(db);
				writeMetaValue(db, 'signedOut', '1');
				postSummary();
				return 'signed-out';
			}
			if (!res.ok) {
				resetSending(db);
				postSummary();
				log.warn(`[device] push: the server answered ${res.status}, the changes wait`);
				return 'offline';
			}
			let body: PushResponse;
			try {
				body = (await res.json()) as PushResponse;
			} catch {
				resetSending(db);
				postSummary();
				return 'offline';
			}
			const { landed } = await exclusive(async () => applyResults(db, user, body.results));
			lastLanded += landed;
			writeMetaValue(db, 'signedOut', '0');
			postSummary();
			// Deferred entries (the server was busy) wait for the next sync.
			if (body.results.some((r) => r.state === 'deferred')) return 'waiting';
		}
	}

	const sync = oneAtATime(async () => {
		syncResult = await syncOnce();
	});
	let syncResult: SyncResult = 'synced';

	async function syncOnce(): Promise<SyncResult> {
		try {
			for (let round = 0; round < 2; round++) {
				const pushed = await pushAll();
				if (pushed !== 'pushed') return pushed;
				if (outboxSummary(db, copyUser()).waiting > 0) return 'waiting';
				// A failed apply pulls once more at once, a full pull; a second failure waits for the next ask.
				let out = await pullOnce();
				if (out === 'again') out = await pullOnce();
				if (out === 'again') {
					log.error('[device] pull: applying failed twice, waiting for the next pull');
					return 'synced';
				}
				if (out === 'signed-out') return 'signed-out';
				// A change was made while the answer was on its way: push it, then pull once more.
				if (out === 'dropped') continue;
				return outboxSummary(db, copyUser()).waiting > 0 ? 'waiting' : 'synced';
			}
			return 'waiting';
		} catch (e) {
			// The server would not start, or the database itself fails.
			log.error('[device] sync failed', e);
			if (state !== 'ready') setState('failed');
			return 'offline';
		}
	}

	const pull = () => sync();

	/**
	 * A device-first write: run here in one transaction with its capture, then
	 * recorded in the outbox, or rolled back and handed to the network.
	 */
	async function write(
		wire: WireRequest,
		person: string | null | undefined
	): Promise<WireResponse | WireFallback> {
		if (state !== 'ready' || !respond || !runtime) return fallback(`device ${state ?? 'off'}`);
		if (person !== undefined && person !== runtime.userId) {
			return fallback("the copy is not this page's person's");
		}
		const slot = runtime.slot;
		if (slot === null) return fallback('the device has no id slot yet');
		const url = new URL(wire.url);
		const cls = writeClass(wire.method, url);
		if (cls !== 'device' && cls !== 'queued') return fallback('the network answers this');
		const epoch = new Headers(wire.headers).get('x-page-epoch');
		if (epoch === null || Number(epoch) !== deps.epoch) return fallback('a page of another build');
		if (!copyHasUser(db, runtime.userId)) return fallback('the copy has no user');

		const madeAt = deps.now();
		const marks = Object.fromEntries(
			(
				db.prepare('SELECT tbl, hi FROM id_marks WHERE slot = ?').all(slot) as {
					tbl: string;
					hi: number;
				}[]
			).map((r) => [r.tbl, r.hi])
		);
		const headers = deviceHeaders(wire.headers, runtime.cookies, deps.userAgent, url.origin);
		let open = false;
		const undo = () => {
			if (open) db.exec('ROLLBACK');
			open = false;
		};
		try {
			db.exec('BEGIN');
			open = true;
			startCapture(db);
			const res = await respond(
				new DeviceRequest(url, { method: wire.method, body: wire.body }, headers)
			);
			const bytes = await res.arrayBuffer();
			const rows = stopCapture(db);
			const answer = (extra: [string, string][] = []): WireResponse => ({
				status: res.status,
				headers: [...res.headers, ...extra],
				body: bytes
			});
			const isAction = headers.has('x-sveltekit-action');
			const type = isAction ? actionOutcome(bytes).type : null;
			const landed = isAction ? type === 'success' || type === 'redirect' : res.status < 400;
			if (!landed) {
				undo();
				if (res.status >= 500) return fallback('the device failed');
				// Online the copy may be behind the server (a drill added on the PC a minute ago):
				// the server decides. Offline the person sees the refusal here.
				return deps.online() ? fallback('refused on the device') : answer();
			}
			if (rows.length === 0) {
				undo();
				return deps.online() ? fallback('nothing on the device') : answer();
			}
			if (deps.online()) {
				const get = (table: string, id: number) => rowById(db, table, id);
				const team = rows.some(
					(r) =>
						ownerOf(r.tbl, (r.after ?? r.before ?? {}) as Record<string, unknown>, get) !== 'person'
				);
				// A group's row online goes to the server first: a clash shows at once, in place.
				if (team) {
					undo();
					return fallback('group-online');
				}
			}
			const action =
				[...url.searchParams.keys()].find((k) => k.startsWith('/'))?.slice(1) ?? 'default';
			const recorded = new Set<string>(RECORDED_HEADERS);
			const kept: [string, string][] = wire.headers.filter(
				([k]) => recorded.has(k.toLowerCase()) && k.toLowerCase() !== 'cookie'
			);
			const cookie = headers.get('cookie');
			if (cookie) kept.push(['cookie', cookie]);
			// The service worker gave up waiting and went to the network: this one must not land too.
			if (wire.deadline !== undefined && deps.now() > wire.deadline) {
				undo();
				return fallback('too late');
			}
			const seq = recordEntry(db, {
				id: deps.newId(),
				userId: runtime.userId,
				madeAt,
				epoch: deps.epoch,
				cls,
				url: url.pathname + url.search,
				method: wire.method.toUpperCase(),
				headers: kept,
				body: wire.body === null ? null : new Uint8Array(wire.body),
				minted: mintedIn(rows, slot, marks),
				rows,
				label: entryLabel(action, rows, thingName(db, action, rows))
			});
			db.exec('COMMIT');
			open = false;
			deps.onRecorded();
			return answer([[OUTBOX_HEADER, String(seq)]]);
		} catch (e) {
			undo();
			log.error('[device] a write failed', wire.url, e);
			return fallback(String(e));
		}
	}

	return {
		async start() {
			started = true;
			setState('starting');
			try {
				// The outbox and the capture triggers, rebuilt to the migrated columns at every open.
				installCapture(db);
				// After a restart nothing is on its way: what was being sent waits again.
				resetSending(db);
				ensureDeviceKey(db, deps.newId);
				wipeOther();
				postSummary();
				if (wanted === null) return setState('empty');
				if (deps.online()) {
					const pulled = pull();
					if (!copyFits()) await pulled;
				}
				if (copyFits()) await serve();
				else setState('empty');
			} catch (e) {
				log.error('[device] start failed', e);
				setState('failed');
			}
		},

		pull,

		async sync() {
			await sync();
			return syncResult;
		},

		summary: () => outboxSummary(db, copyUser()),

		outboxList: async () => {
			const user = copyUser();
			return user === null ? [] : outboxItems(db, user);
		},

		async retry(id) {
			const user = copyUser();
			if (user === null) return 0;
			const n = await exclusive(async () => retryEntry(db, user, id));
			postSummary();
			void sync();
			return n;
		},

		async discard(id) {
			const user = copyUser();
			if (user === null) return 0;
			const n = await exclusive(async () => discardEntry(db, user, id));
			postSummary();
			// The next pull puts back the server's state where the change was.
			await sync();
			return n;
		},

		async resolve(id) {
			const user = copyUser();
			if (user === null) return 0;
			const n = await exclusive(async () => resolveEntry(db, user, id));
			postSummary();
			await sync();
			return n;
		},

		async forget() {
			await exclusive(async () => {
				const user = copyUser();
				wipeCopy(db);
				if (user !== null) forgetPerson(db, user);
			});
			postSummary();
			setState('empty');
		},

		async person(userId) {
			if (userId === wanted) return;
			wanted = userId;
			if (!started) return;
			const mine = ++switches;
			try {
				wipeOther();
				if (copyFits()) return await serve();
				if (userId === null) return setState('empty');
				setState('starting');
				await pull();
				if (mine === switches && !copyFits() && state !== 'failed') setState('empty');
			} catch (e) {
				log.error('[device] could not change person', e);
				// The copy may still be the other person's: it answers nothing.
				setState('failed');
			}
		},

		async answer(wire, person) {
			const m = wire.method.toUpperCase();
			if (m !== 'GET' && m !== 'HEAD') return exclusive(() => write(wire, person));
			if (state !== 'ready' || !respond || !runtime) return fallback(`device ${state ?? 'off'}`);
			if (person !== undefined && person !== runtime.userId) {
				return fallback("the copy is not this page's person's");
			}
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
