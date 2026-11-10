/** What the pull sends (offline phase 2). PURE types, client-safe: the device imports them. */
import type { Release } from '$lib/app-update/agent';
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
};
export type PullRefusal = { refused: 'schema'; schema: string };
