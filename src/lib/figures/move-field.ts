/**
 * PURE, client-safe: the Move field of a New figure form. Its picker's create
 * row turns the search into a move: an existing one when the name folds to the
 * same (no second "Enchufla"), else a new move made with the figure.
 */
import { fold } from '$lib/fold';

/** A move's name is up to 200 characters, as the server's `text` reads it. */
const MOVE_NAME_MAX = 200;

export type MoveChoice = { groupId: number } | { newName: string };

export function moveFromQuery(
	query: string,
	moves: readonly { id: number; name: string }[]
): MoveChoice | null {
	const name = query.trim().slice(0, MOVE_NAME_MAX).trim();
	if (!name) return null;
	const key = fold(name);
	const same = moves.find((m) => fold(m.name.trim()) === key);
	return same ? { groupId: same.id } : { newName: name };
}
