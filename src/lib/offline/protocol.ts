/*
 * The messages between the service worker, the page and the device worker
 * (offline phase 2). PURE types, client-safe: the worker, the service worker
 * and the page all import them.
 */
import type { ClashInfo, GoneInfo } from '$lib/clash/clash';
import type { EntryLabel, RefusalReason } from '$lib/sync/outbox';

/** A request as it crosses a `MessagePort`: the service worker's `Request`, taken apart. */
export type WireRequest = {
	url: string;
	method: string;
	headers: [string, string][];
	body: ArrayBuffer | null;
	/**
	 * A write's last moment to commit (epoch ms, offline phase 3): after it the
	 * service worker has gone to the network, so the device rolls back.
	 */
	deadline?: number;
};

/** The device's answer, taken apart the same way. */
export type WireResponse = { status: number; headers: [string, string][]; body: ArrayBuffer };

/** The device cannot answer: the service worker gives its own offline answer. */
export type WireFallback = { fallback: true; reason: string };

/**
 * The device worker's state:
 * - `waiting`: another tab holds the copy; requests go to the network;
 * - `starting`: SQLite, the migrations, and the first pull when there is no copy yet;
 * - `empty`: no copy (never pulled, or signed out) and nothing to pull it from;
 * - `ready`: the copy answers;
 * - `failed`: the worker could not start.
 */
export type DeviceState = 'waiting' | 'starting' | 'empty' | 'ready' | 'failed';

/**
 * To the worker. `device-fetch` carries a reply port: `WireResponse` or
 * `WireFallback` comes back on it, and the page's person when it knows
 * (`pagePerson`; absent: not yet). `person`: who the server says is signed in
 * on the page, sent at the start and on every change (null: signed out).
 */
export type DeviceIn =
	/** Reads and writes. */
	| { type: 'device-fetch'; request: WireRequest; person?: string | null }
	/** Sync: push, then pull. */
	| { type: 'pull' }
	| { type: 'person'; userId: string | null }
	/** The Sync page's (offline phase 3); each carries a reply port. */
	| { type: 'outbox-list' }
	| { type: 'retry'; id: string }
	| { type: 'discard'; id: string }
	| { type: 'resolve'; id: string }
	| { type: 'sync-now' }
	| { type: 'forget' };

/**
 * From the worker. `pulled`: a pull landed; `startedAt` is when its request
 * left (the wall clock the page shares), so the page knows which writes it holds.
 */
export type DeviceOut =
	| { type: 'state'; state: DeviceState }
	/** `landed`: how many outbox entries the pushes before this pull landed. */
	| { type: 'pulled'; cursor: number; startedAt: number; landed: number }
	/** After every change to the outbox or its meta (offline phase 3). */
	| { type: 'outbox'; summary: OutboxSummary };

/**
 * From the service worker to the page. `device-fetch` carries a reply port and
 * is relayed to the worker as is (a `DeviceIn`); `changed`: a write reached the
 * server, pull soon; `needs-connection`: a write could not, say so.
 */
export type SwOut =
	| { type: 'device-fetch'; request: WireRequest }
	| { type: 'changed' }
	| { type: 'needs-connection' };

/**
 * From the page to the service worker:
 * - `device-state`: its device's state, on every change (`off`: none started),
 *   with `unpulledSince`, when the page last saved something its device has
 *   not pulled yet (null: nothing), so a service worker that restarted or was
 *   replaced learns it again;
 * - `device-pulled`: its device pulled, the request having left at `startedAt`.
 */
export type SwIn =
	| {
			type: 'device-state';
			state: DeviceState | 'off';
			unpulledSince: number | null;
			/** Outbox entries waiting (offline phase 3); absent from an older page. */
			waiting?: number;
			/** The newest outbox entry the device holds. */
			outboxSeq?: number;
	  }
	| { type: 'device-pulled'; startedAt: number }
	/** The outbox changed: what the service worker keeps across its restarts. */
	| { type: 'outbox'; waiting: number; epochs: number[] };

/** What the band and the Sync page need to know about the outbox (offline phase 3). */
export type OutboxSummary = {
	/** Waiting and sending. */
	waiting: number;
	/** The made-at of the oldest of them. */
	oldestWaitingAt: number | null;
	refused: number;
	held: number;
	signedOut: boolean;
	lastSyncedAt: number | null;
	/** The newest entry's seq (0: none). */
	seq: number;
	/** queuedMarks of waiting queued entries → their made-at. */
	queued: Record<string, number>;
	/** Distinct epochs of waiting entries. */
	epochs: number[];
};

/** One entry as the Sync page lists it. */
export type OutboxItem = {
	id: string;
	seq: number;
	state: 'waiting' | 'sending' | 'refused' | 'held';
	madeAt: number;
	url: string;
	label: EntryLabel;
	reason: RefusalReason | null;
	message: string | null;
	clash: ClashInfo | null;
	gone: GoneInfo | null;
	heldBy: string | null;
	dependents: number;
	fields: [string, string][];
};
