/**
 * The fetch side of "Archived by Ana · Restore": bring back a group's
 * variation, routine or drill that a picker offered and someone archived
 * since. Resolves to null when it is back, or to the words of a refusal
 * ("Enchufla is taken; rename that one first").
 */
export type ArchivedTarget = { figureId: number } | { routineId: number } | { exerciseId: number };

export async function restoreArchived(target: ArchivedTarget): Promise<string | null> {
	try {
		const res = await fetch('/api/archived', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(target)
		});
		if (res.ok) return null;
		const body: unknown = await res.json().catch(() => null);
		const said = body && typeof body === 'object' ? (body as { message?: unknown }).message : null;
		return typeof said === 'string' && said ? said : 'That could not be restored.';
	} catch {
		return 'That could not be restored.';
	}
}
