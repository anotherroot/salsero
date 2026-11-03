/** PURE, client-safe: the wording for what a group's members do not see yet. */

export const HIDDEN_FROM_MEMBERS = "Members don't see it yet";

export const MEMBERS_NOTE =
	'Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.';

/** True when some row is known to be hidden from members (`membersSee === false`). */
export function anyHidden(rows: { membersSee?: boolean }[]): boolean {
	return rows.some((r) => r.membersSee === false);
}
