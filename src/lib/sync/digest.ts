/*
 * A synced row's key as one string, and the text a table's digest is taken
 * over. PURE and client-safe: the server (`syncScope`, the pull) and the
 * device compute the same strings, and `change_log.key` is written the same
 * way by the triggers (`triggers.ts`: CAST(… AS TEXT) for one column,
 * json_array(…) for several).
 */

/** One key value as its text; several as a JSON array (`[3,"u1"]`). */
export function keyString(values: readonly unknown[]): string {
	return values.length === 1 ? String(values[0]) : JSON.stringify(values);
}

/** The keys sorted with the default JS sort, joined by '\n': what a table's digest hashes. */
export function digestInput(keys: Iterable<string>): string {
	return [...keys].sort().join('\n');
}
