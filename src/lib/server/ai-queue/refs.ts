/**
 * `{ "ref": <action id> }` in a line's payload: what that action's create made.
 * Using a ref makes the action need that one (`needs`). A ref under `move`
 * (create_figure's move) is the move a new figure was made in; anywhere else
 * it is the made thing itself. PURE.
 */

/** What an action's create made: its `id`, and for a new figure its `moveId`. */
export type Made = { id: number; moveId?: number };

const isRef = (v: unknown): v is { ref: number } =>
	!!v &&
	typeof v === 'object' &&
	!Array.isArray(v) &&
	Object.keys(v).length === 1 &&
	Number.isInteger((v as { ref: unknown }).ref);

export function refsOf(payload: unknown): number[] {
	if (isRef(payload)) return [payload.ref];
	if (Array.isArray(payload)) return payload.flatMap(refsOf);
	if (payload && typeof payload === 'object') return Object.values(payload).flatMap(refsOf);
	return [];
}

/** The id a ref stands for under this key. */
export const madeId = (made: Made, key: string | null) =>
	key === 'move' ? (made.moveId ?? made.id) : made.id;

class Missing {
	constructor(readonly id: number) {}
}

function walk(v: unknown, created: Map<number, Made>, key: string | null): unknown {
	if (isRef(v)) {
		const made = created.get(v.ref);
		if (made === undefined) throw new Missing(v.ref);
		return madeId(made, key);
	}
	if (Array.isArray(v)) return v.map((x) => walk(x, created, key));
	if (v && typeof v === 'object')
		return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, created, k)]));
	return v;
}

/** The payload with every ref replaced, or the first action whose make is not known yet. */
export function resolveRefs(
	payload: unknown,
	created: Map<number, Made>
): unknown | { missing: number } {
	try {
		return walk(payload, created, null);
	} catch (e) {
		if (e instanceof Missing) return { missing: e.id };
		throw e;
	}
}
