/**
 * `{ "ref": <action id> }` in a line's payload: the id that action's create made.
 * Using a ref makes the action need that one (`needs`). PURE.
 */

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

class Missing {
	constructor(readonly id: number) {}
}

function walk(v: unknown, created: Map<number, number>): unknown {
	if (isRef(v)) {
		const id = created.get(v.ref);
		if (id === undefined) throw new Missing(v.ref);
		return id;
	}
	if (Array.isArray(v)) return v.map((x) => walk(x, created));
	if (v && typeof v === 'object')
		return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, created)]));
	return v;
}

/** The payload with every ref replaced, or the first action whose id is not known yet. */
export function resolveRefs(
	payload: unknown,
	created: Map<number, number>
): unknown | { missing: number } {
	try {
		return walk(payload, created);
	} catch (e) {
		if (e instanceof Missing) return { missing: e.id };
		throw e;
	}
}
