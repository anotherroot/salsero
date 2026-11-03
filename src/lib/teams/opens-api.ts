/**
 * The fetch side of `POST /api/opens`: tell the server a group's lesson is
 * shown, so "new" clears. Fire and forget; a failure only leaves it marked new.
 */
export function reportOpen(kind: 'lesson', id: number): void {
	void fetch('/api/opens', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ kind, id }),
		keepalive: true
	}).catch(() => {});
}
