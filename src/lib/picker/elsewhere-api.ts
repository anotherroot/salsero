/**
 * Link from other places: the picker's call to `/api/elsewhere` while the
 * person searches a group's picker. Network only; a failure (offline, or the
 * server) rejects, and the picker says other places need a connection.
 */
import type { ElsewhereKind, ElsewherePlace } from '$lib/types';

export async function fetchElsewhere(
	into: number,
	kinds: ElsewhereKind[],
	q: string,
	signal?: AbortSignal
): Promise<ElsewherePlace[]> {
	const params = new URLSearchParams({ into: String(into), kinds: kinds.join(','), q });
	const res = await fetch(`/api/elsewhere?${params}`, { signal });
	if (!res.ok) throw new Error(`elsewhere ${res.status}`);
	return res.json();
}
