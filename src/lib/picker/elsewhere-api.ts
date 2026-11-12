/**
 * Link from other places: the picker's call to `/api/elsewhere` while the
 * person searches a group's picker. Network only; a failure (offline, or the
 * server) rejects, and the picker says other places need a connection.
 */
import type { ElsewhereFind, ElsewhereKind, ElsewherePlace, PositionSummary } from '$lib/types';

export async function fetchElsewhere(
	into: number,
	kinds: ElsewhereFind[],
	q: string,
	signal?: AbortSignal
): Promise<ElsewherePlace[]> {
	const params = new URLSearchParams({ into: String(into), kinds: kinds.join(','), q });
	const res = await fetch(`/api/elsewhere?${params}`, { signal });
	if (!res.ok) throw new Error(`elsewhere ${res.status}`);
	return res.json();
}

/** What Copy and use answers: the copy's id in the group (a position's summary too), Restore, or why not. */
export type CopyUseAnswer =
	| { ok: true; id: number; made: boolean; position?: PositionSummary }
	| { ok: false; restore: number }
	| { ok: false; message: string | null };

/**
 * Copy and use (a group's field pickers): copy a row from another place into
 * the group `into` (`POST /api/elsewhere/copy`), or restore the family's
 * archived member there. Network only; a failure answers no message.
 */
export async function copyToUse(
	into: number,
	kind: ElsewhereKind,
	id: number,
	use: Record<string, number>,
	restore: number | null
): Promise<CopyUseAnswer> {
	try {
		const res = await fetch('/api/elsewhere/copy', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ into, kind, id, use, restore })
		});
		const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
		if (res.ok && typeof body?.id === 'number')
			return {
				ok: true,
				id: body.id,
				made: body.made === true,
				...(body.position ? { position: body.position as PositionSummary } : {})
			};
		if (res.status === 409 && typeof body?.restore === 'number')
			return { ok: false, restore: body.restore };
		return { ok: false, message: typeof body?.message === 'string' ? body.message : null };
	} catch {
		return { ok: false, message: null };
	}
}
