/** An id the AI gives: a whole number, or `{ "ref": <action id> }` for what an earlier action makes. */
import { refuse, wholeNumber, type Parsed } from '../../mcp/args';

export type IdOrRef = number | { ref: number };

export function idOrRef(v: unknown, key: string): Parsed<IdOrRef> {
	const id = wholeNumber(v, 1, Number.MAX_SAFE_INTEGER);
	if (id !== null) return { ok: true, args: id };
	if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1) {
		const ref = wholeNumber((v as { ref?: unknown }).ref, 1, Number.MAX_SAFE_INTEGER);
		if (ref !== null) return { ok: true, args: { ref } };
	}
	return refuse(
		`${key} must be a whole number, or {"ref": <action id>} for what an earlier action makes.`
	);
}

/** At run, refs are already numbers; this narrows the type. */
export const resolved = (v: IdOrRef): number => (typeof v === 'number' ? v : NaN);
export const isRef = (v: IdOrRef): v is { ref: number } => typeof v !== 'number';
