/** What the pull sends (offline phase 2). PURE types, client-safe: the device imports them. */
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
};
export type PullRefusal = { refused: 'schema'; schema: string };
