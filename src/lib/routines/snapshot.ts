/**
 * What deleting slots returns and what undoing that delete posts back.
 *
 * PURE and client-safe: the page holds a snapshot between the delete and the
 * Undo tap, and the route parses it back from a form field. Strict, because it
 * arrives as text from the client: every id a positive integer, every slot
 * holding exactly one kind of thing, the note within the 200 characters a note
 * may have. The data function still checks dance and embedding — this only
 * guarantees the shape.
 */
export interface SlotSnapshot {
	/** Where the slot stood when it was deleted. Restored there, or at the end if the routine has since shrunk. */
	position: number;
	childId: number | null;
	note: string | null;
	/** Main figure first. Empty for a child slot. */
	figureIds: number[];
}

/** More than any routine anyone dances; a bound so a tampered body cannot loop the server. */
const MAX_SLOTS = 200;

const isIndex = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const isId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

export function parseSnapshots(raw: string): SlotSnapshot[] | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SLOTS) return null;
	const out: SlotSnapshot[] = [];
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null) return null;
		const { position, childId, note, figureIds } = entry as Record<string, unknown>;
		if (!isIndex(position)) return null;
		if (childId !== null && !isId(childId)) return null;
		if (note !== null && (typeof note !== 'string' || note.length > 200)) return null;
		if (!Array.isArray(figureIds) || !figureIds.every(isId)) return null;
		if (new Set(figureIds).size !== figureIds.length) return null;
		// Exactly one of the two: a slot of figures, or a slot holding a routine.
		if ((childId === null) === (figureIds.length === 0)) return null;
		out.push({ position, childId, note, figureIds });
	}
	if (new Set(out.map((s) => s.position)).size !== out.length) return null;
	return out;
}
