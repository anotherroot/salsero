/** What the pull sends (offline phase 2). PURE types, client-safe: the device imports them. */
export type TableRows = { cols: string[]; rows: unknown[][] };
export type PullRequest = { cursor: number; schema: string; digests?: Record<string, string> };
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
};
export type PullRefusal = { refused: 'schema'; schema: string };
