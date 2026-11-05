/** The person's choices for one day on Today (`today_picks`). Client-safe. */
export type PickKind = 'next' | 'add' | 'skip';

export interface DayPick {
	id: number;
	exerciseId: number;
	kind: PickKind;
	createdAt: number;
}

/** What the `pick` action says back: the picks it made, and the exercises whose skip it took away. */
export interface PickReply {
	pickIds?: number[];
	unskipped?: number[];
}

export type UndoStep =
	| { action: 'pick'; fields: { exerciseId: number; kind: 'skip' } }
	| { action: 'unpick'; fields: { pickId: number } };

/**
 * Undo of Coming up's +, as the actions to post in order: skip again what the +
 * un-skipped (first: a skip keeps any add/next, so the row stays hidden even if
 * the next step fails), then take away the pick it made. Empty when the + changed
 * nothing: the toast then offers no Undo.
 */
export function undoAddSteps(exerciseId: number, reply: PickReply): UndoStep[] {
	const steps: UndoStep[] = [];
	if (reply.unskipped?.includes(exerciseId))
		steps.push({ action: 'pick', fields: { exerciseId, kind: 'skip' } });
	for (const pickId of reply.pickIds ?? []) steps.push({ action: 'unpick', fields: { pickId } });
	return steps;
}
