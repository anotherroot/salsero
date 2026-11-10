/*
 * The messages between the service worker, the page and the device worker
 * (offline phase 2). PURE types, client-safe: the worker, the service worker
 * and the page all import them.
 */
import type { ClashInfo, GoneInfo } from '$lib/clash/clash';
import type { DeviceLabel } from '$lib/devices/label';
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
	| { type: 'forget' }
	/** Videos kept on the phone (offline phase 4b); each carries a reply port, answered with `KeepStatus | null`. */
	| { type: 'keep-get' }
	| { type: 'keep-set'; change: KeepChange }
	/**
	 * A person's own video kept only on this phone (offline phase 4c), each with a
	 * reply port: `OriginalPut`, `{ blob: Blob | null }`, `{ ok: boolean }`.
	 */
	| { type: 'original-put'; file: string; mime: string; blob: Blob }
	| { type: 'original-get'; file: string }
	| { type: 'original-drop'; file: string };

/** `original-put`'s answer: stored, or why not (no room, or no store or person here). */
export type OriginalPut = { ok: true } | { ok: false; reason: 'space' | 'store' };

/**
 * From the worker. `pulled`: a pull landed; `startedAt` is when its request
 * left (the wall clock the page shares), so the page knows which writes it holds.
 */
export type DeviceOut =
	| { type: 'state'; state: DeviceState }
	/**
	 * `landed`: how many outbox entries the pushes before this pull landed;
	 * `changed`: how much the pull changed in the copy (`applyPull`), 0 for nothing.
	 */
	| { type: 'pulled'; cursor: number; startedAt: number; landed: number; changed: number }
	/** After every change to the outbox or its meta (offline phase 3). */
	| { type: 'outbox'; summary: OutboxSummary }
	/** After every media pass and settings change, and while a file comes (offline phase 4b). */
	| { type: 'keep'; status: KeepStatus };

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
	| { type: 'outbox'; waiting: number; epochs: number[] }
	/** Whether this browser holds a copy (device first, step 2): a page load is drawn from it. */
	| { type: 'copy'; has: boolean };

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

/*
 * Videos kept on the phone (offline phase 4b). The settings are this device's
 * (`device_meta` `keep`): a space is `mine` or `team:<id>`; a kept video is
 * `<kind>/<file>`, its media path without the first slash.
 */
export type SpaceId = string;
export type KeepSettings = { spaces: SpaceId[]; wifiOnly: boolean; videos: string[] };
export type KeepChange =
	| { space: SpaceId; on: boolean }
	| { wifiOnly: boolean }
	| { video: string; on: boolean }
	| { clear: true };
/** A space's row on the On this phone page. `name` null: My lessons. */
export type SpaceRow = {
	id: SpaceId;
	name: string | null;
	on: boolean;
	videos: number;
	bytes: number;
	held: number;
	heldBytes: number;
};
/** A video kept by itself; `index` is its place on its lesson (1-based), null for a recording. */
export type KeptVideo = {
	key: string;
	title: string;
	index: number | null;
	bytes: number;
	held: boolean;
};
export type KeepStatus = {
	settings: KeepSettings;
	spaces: SpaceRow[];
	kept: KeptVideo[];
	/** Video keys a switched-on space keeps → its id. */
	bySpace: Record<string, SpaceId>;
	/** Whole video files on the phone, `<kind>/<file>`. */
	held: string[];
	/** Cut-off downloads kept to go on from: video key → bytes so far. */
	partial: Record<string, number>;
	inFlight: { key: string; received: number; total: number } | null;
	/** Why wanted videos are not coming now. */
	waiting: 'wifi' | 'offline' | 'space' | null;
	canTellWifi: boolean;
	/** `originals`: the person's own phone-only videos held here (offline phase 4c). */
	bytes: { songs: number; videos: number; originals?: number };
	/** This device's id slot (offline phase 4c: which originals are its own); null until it has one. */
	slot?: number | null;
	/** The file names of the person's originals on this phone (offline phase 4c). */
	originals?: string[];
	/** The person's devices that hold originals, by slot (the last pull's `ServerExtras.devices`). */
	devices?: Record<string, DeviceLabel>;
	/** Free for this app (quota − usage); null where the browser won't say. */
	free: number | null;
	low: boolean;
};
