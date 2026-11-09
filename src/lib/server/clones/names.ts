/**
 * Name rules for the clone engine.
 */

/** A name as the uniqueness rules compare it: trimmed, any case. */
export const norm = (name: string) => name.trim().toLowerCase();

/** `name`, or the first of "name (2)", "name (3)", … that is not `taken`. */
export function suffixed(name: string, taken: (n: string) => boolean): string {
	if (!taken(name)) return name;
	for (let n = 2; ; n++) {
		const next = `${name} (${n})`;
		if (!taken(next)) return next;
	}
}
