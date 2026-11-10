/** What the pull sends (offline phase 2). PURE types, client-safe: the device imports them. */
import type { Release } from '$lib/app-update/agent';
import type { DeviceLabel } from '$lib/devices/label';
import type { SongImportRow } from '$lib/types';

export type TableRows = { cols: string[]; rows: unknown[][] };
/**
 * `userId`: whose copy the cursor and digests are (null: none). The server
 * sends everything when it is not the signed-in person, or not said (an older
 * device): another person's digests say nothing about this one's rows.
 */
export type PullRequest = {
	cursor: number;
	schema: string;
	digests?: Record<string, string>;
	userId?: string | null;
	/** The device key (offline phase 3): the server hands this database its id slot. */
	device?: string;
};
export type PullResponse = {
	userId: string;
	cursor: number;
	schema: string;
	/** Tables the device replaces with `changed[t]`. */
	full: string[];
	/** Full tables: every row in scope; others: upserts. */
	changed: Record<string, TableRows>;
	/** The page cookies the loads read. */
	cookies: Record<string, string>;
	/** The device's id slot: present when the request named its `device`. */
	slot?: number;
	/** What only the server knows, for the layouts drawn on the device (device first); absent from an older server. */
	extras?: ServerExtras;
	/**
	 * The clone pairs among the person's rows (`clone_pairs` is never synced, but what
	 * differs between copies and what was skipped is drawn from it): the device
	 * replaces its own table with them. Absent from an older server.
	 */
	clonePairs?: ClonePairRow[];
};

/**
 * What the layouts read from tables the copy never holds (or the server's disk):
 * the device draws them from the last pull, up to a pull old.
 */
export type ServerExtras = {
	/** The Music dot (`importsWaiting`). */
	musicToPick: boolean;
	/** The AI's suggestions waiting to be run (`pendingCount`). */
	aiPending: number;
	/** An AI app is connected (`listGrants`). */
	aiConnected: boolean;
	/** The dance's current APK release (`currentRelease`). */
	release: Release | null;
	/** Music's To pick: the person's own view, and each group's they may view by team id. */
	imports: { own: SongImportRow[]; teams: Record<string, SongImportRow[]> };
	/** Each group's Recently deleted bytes (`team_trash`), for its usage, by team id. */
	teamTrashBytes: Record<string, number>;
	/** The last change History holds per group lesson (`team_changes`), keyed `lesson:<id>`: "Edited by". */
	lastEdits: Record<string, { actorId: string; at: number }>;
	/**
	 * What each device holding one of the person's phone-only originals is, by id slot
	 * (offline phase 4c: "On Pixel 8"). Absent from an older server.
	 */
	devices?: Record<string, DeviceLabel>;
};
/** A `clone_pairs` row as stored (raw column names). */
export type ClonePairRow = {
	kind: string;
	a_id: number;
	b_id: number;
	base_json: string;
	at: number;
};

export type PullRefusal = { refused: 'schema'; schema: string };
