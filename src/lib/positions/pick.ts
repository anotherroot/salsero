/**
 * The map's first pick: `?pick=<id>` (a position page's Show on the map), when
 * that position is drawn on the map; anything else picks nothing. PURE,
 * client-safe.
 */
export function pickOf(params: URLSearchParams, ids: readonly number[]): number | null {
	const raw = params.get('pick');
	if (raw === null || !/^\d+$/.test(raw)) return null;
	const id = Number(raw);
	return ids.includes(id) ? id : null;
}
