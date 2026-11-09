/**
 * The fetch side of `POST /api/opens`: tell the server a group's lesson or song is
 * shown, or a lesson's comments (`id` = the lesson), so "new" clears. Fire and
 * forget; a failure only leaves it marked new. A background write: not sent
 * offline, and never "Needs a connection" (`backgroundWrite`).
 */
import { backgroundWrite } from '$lib/offline/background-write';

export function reportOpen(kind: 'lesson' | 'song' | 'comments', id: number): void {
	void backgroundWrite('/api/opens', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ kind, id }),
		keepalive: true
	});
}
