/*
 * The outbox's wire (offline phase 3): what a device sends the server for each
 * change it made, what comes back, and the PURE rules both sides read: how an
 * entry's captured rows fold, which ids it minted, which later entries wait
 * on a refused one, what the Sync page calls an entry, and which things carry
 * the Waiting badge. Client-safe: the device, the service worker, the page and
 * the server import it.
 */
import type { ClashInfo, GoneInfo } from '$lib/clash/clash';
import { OWNERS } from './owners';
import { SYNCED } from './tables';

export type Row = Record<string, string | number | null>;
/** One row a write touched, as the device's triggers captured it. */
export type CapturedRow = {
	tbl: string;
	key: string;
	op: 'i' | 'u' | 'd';
	before: Row | null;
	after: Row | null;
};
export type WireEntry = {
	id: string;
	madeAt: number;
	epoch: number;
	url: string;
	method: string;
	headers: [string, string][];
	/** The request body, base64; null when it had none. */
	body: string | null;
	minted: Record<string, number[]>;
	rows: CapturedRow[];
};
export type PushRequest = { device: string; entries: WireEntry[] };
export type RefusalReason =
	'clash' | 'gone' | 'stale' | 'refused' | 'access' | 'error' | 'not-allowed' | 'bad-ids';
export type EntryResult =
	| { id: string; state: 'landed' }
	| {
			id: string;
			state: 'refused';
			reason: RefusalReason;
			message: string | null;
			clash: ClashInfo | null;
			gone: GoneInfo | null;
	  }
	| { id: string; state: 'held'; heldBy: string }
	| { id: string; state: 'deferred' };
export type PushResponse = { slot: number; results: EntryResult[] };

export const PUSH_BATCH = 20;
export const PUSH_MAX_BYTES = 4 * 1024 * 1024;
export const OUTBOX_HEADER = 'x-salsa-outbox';
/** The request headers an entry keeps: what the action reads. */
export const RECORDED_HEADERS = ['content-type', 'accept', 'x-sveltekit-action', 'cookie'] as const;

const SLOT = 2 ** 32;
const at = (r: CapturedRow) => `${r.tbl}:${r.key}`;

/**
 * One row per table and key, in the order each first appeared: the first
 * `before`, the last `after`. An insert later updated is an insert; inserted
 * and deleted is nothing; updated then deleted is a delete; deleted then
 * inserted is an update.
 */
export function foldCaptured(rows: CapturedRow[]): CapturedRow[] {
	const out = new Map<string, CapturedRow | null>();
	for (const r of rows) {
		const k = at(r);
		const prev = out.get(k);
		if (prev === undefined) {
			out.set(k, { ...r });
			continue;
		}
		if (prev === null) {
			// inserted and deleted earlier in this entry: starts over
			out.set(k, { ...r });
			continue;
		}
		if (r.op === 'd') {
			out.set(k, prev.op === 'i' ? null : { ...prev, op: 'd', after: null });
		} else if (prev.op === 'd') {
			out.set(k, { ...prev, op: 'u', after: r.after });
		} else {
			out.set(k, { ...prev, after: r.after });
		}
	}
	return [...out.values()].filter((r): r is CapturedRow => r !== null);
}

/**
 * The ids this entry minted, per table, in order: inserts into an `id`-keyed
 * table, in the device's slot, above the slot's mark before the entry (a row
 * restored with its own lower id was not minted now).
 */
export function mintedIn(
	rows: CapturedRow[],
	slot: number,
	marks: Record<string, number>
): Record<string, number[]> {
	const out: Record<string, number[]> = {};
	for (const r of rows) {
		if (r.op !== 'i') continue;
		const key = SYNCED[r.tbl];
		if (!key || key.length !== 1 || key[0] !== 'id') continue;
		const id = Number(r.key);
		if (!Number.isInteger(id) || Math.floor(id / SLOT) !== slot) continue;
		if (id <= (marks[r.tbl] ?? slot * SLOT)) continue;
		(out[r.tbl] ??= []).push(id);
	}
	return out;
}

export type DepEntry = {
	id: string;
	url: string;
	rows: CapturedRow[];
	minted: Record<string, number[]>;
};

function valuesOf(rows: CapturedRow[]): Set<string> {
	const vals = new Set<string>();
	for (const r of rows) {
		for (const side of [r.before, r.after]) {
			if (!side) continue;
			for (const v of Object.values(side)) if (v !== null) vals.add(String(v));
		}
	}
	return vals;
}

/**
 * Whether `later` needs `earlier` to have landed: it touches a row `earlier`
 * wrote, or names an id `earlier` minted (in its URL's path, or in a row).
 */
export function dependsOn(later: DepEntry, earlier: DepEntry): boolean {
	const wrote = new Set(earlier.rows.map(at));
	if (later.rows.some((r) => wrote.has(at(r)))) return true;
	const ids = Object.values(earlier.minted).flat().map(String);
	if (ids.length === 0) return false;
	const path = new URL(later.url, 'http://x').pathname.split('/');
	const vals = valuesOf(later.rows);
	return ids.some((id) => path.includes(id) || vals.has(id));
}

/** Each entry waiting on a refused one (directly or through another waiting one), mapped to that refused root. */
export function heldBy(entries: DepEntry[], refused: ReadonlySet<string>): Map<string, string> {
	const held = new Map<string, string>();
	const blocked: DepEntry[] = [];
	for (const e of entries) {
		if (refused.has(e.id)) {
			blocked.push(e);
			continue;
		}
		const on = blocked.find((x) => dependsOn(e, x));
		if (!on) continue;
		held.set(e.id, refused.has(on.id) ? on.id : held.get(on.id)!);
		blocked.push(e);
	}
	return held;
}

/**
 * The things that carry the Waiting badge while their entry is on its way,
 * and how a captured row names one: the row itself (null), or the row its
 * column points at.
 */
export const QUEUED_MARK: Readonly<Record<string, string | null>> = {
	songs: null,
	lessons: null,
	lesson_comments: null,
	lesson_comment_hearts: 'comment_id',
	video_downloads: 'link_id'
};

const MARK_TABLE: Record<string, string> = {
	comment_id: 'lesson_comments',
	link_id: 'links'
};

/** `"<table>:<key>"` for each thing an entry's rows mark Waiting. */
export function queuedMarks(rows: CapturedRow[]): string[] {
	const out: string[] = [];
	for (const r of rows) {
		if (!(r.tbl in QUEUED_MARK)) continue;
		const col = QUEUED_MARK[r.tbl];
		if (col === null) {
			out.push(at(r));
			continue;
		}
		const v = (r.after ?? r.before)?.[col];
		if (v !== null && v !== undefined) out.push(`${MARK_TABLE[col]}:${v}`);
	}
	return [...new Set(out)];
}

export type EntryLabel = {
	kind: 'log' | 'note' | 'name' | 'new' | 'removed' | 'edit' | 'comment' | 'heart' | 'other';
	thing: string | null;
};

const isRoot = (tbl: string) => {
	const rule = OWNERS[tbl];
	return !!rule && 'root' in rule;
};

/** What the Sync page calls an entry: its kind, and the thing it was about (passed in). */
export function entryLabel(action: string, rows: CapturedRow[], thing: string | null): EntryLabel {
	if (action === 'done') return { kind: 'log', thing };
	const r = rows.find(
		(x) => isRoot(x.tbl) || x.tbl === 'lesson_comments' || x.tbl === 'lesson_comment_hearts'
	);
	if (!r) return { kind: 'other', thing };
	if (r.tbl === 'lesson_comment_hearts') return { kind: 'heart', thing };
	if (r.op === 'i') return { kind: r.tbl === 'lesson_comments' ? 'comment' : 'new', thing };
	if (r.op === 'd') return { kind: 'removed', thing };
	const before = r.before ?? {};
	const after = r.after ?? {};
	if (
		(before.archived_at === null || before.archived_at === undefined) &&
		after.archived_at !== null &&
		after.archived_at !== undefined
	) {
		return { kind: 'removed', thing };
	}
	const changed = Object.keys(after).filter((k) => before[k] !== after[k]);
	if (changed.length > 0 && changed.every((k) => k === 'notes')) return { kind: 'note', thing };
	if (changed.length > 0 && changed.every((k) => k === 'name' || k === 'title')) {
		return { kind: 'name', thing };
	}
	return { kind: 'edit', thing };
}

const HIDDEN_FIELDS = new Set(['seen', 'fingerprint']);

/** A form body's text fields (url-encoded or multipart), without what the person never typed. */
export async function bodyFields(
	contentType: string | null,
	body: Uint8Array | null
): Promise<[string, string][]> {
	if (!contentType || !body) return [];
	const type = contentType.split(';')[0].trim().toLowerCase();
	if (type !== 'application/x-www-form-urlencoded' && type !== 'multipart/form-data') return [];
	const form = await new Response(body as BodyInit, {
		headers: { 'content-type': contentType }
	}).formData();
	const out: [string, string][] = [];
	for (const [k, v] of form.entries()) {
		if (typeof v === 'string' && !HIDDEN_FIELDS.has(k)) out.push([k, v]);
	}
	return out;
}

export function base64Of(bytes: Uint8Array): string {
	let s = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(s);
}

export function bytesOf(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}
