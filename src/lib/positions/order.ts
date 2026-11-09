/** The Positions list's order (ruling 7). PURE, client-safe. */
import { fold } from '$lib/fold';

/**
 * By type in the dance's order (`types`), untyped last, then folded name, then
 * id: the person's own and the groups' mixed in alike.
 */
export function positionOrder(
	types: readonly string[]
): (
	a: { id: number; name: string; styleTag: string | null },
	b: { id: number; name: string; styleTag: string | null }
) => number {
	const rank = (r: { styleTag: string | null }) => {
		const i = r.styleTag === null ? -1 : types.indexOf(r.styleTag);
		return i < 0 ? types.length : i;
	};
	return (a, b) =>
		rank(a) - rank(b) ||
		(fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0) ||
		a.id - b.id;
}
