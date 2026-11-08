/** PURE, client-safe: the wording for what a group's members do not see yet. */
import { t } from '$lib/i18n/catalog';

/** The marker on a row members do not see. */
export const hiddenFromMembers = (): string => t().moves.members.hidden;

/** The note over a list that holds such a row. */
export const membersNote = (): string => t().moves.members.note;

/** True when some row is known to be hidden from members (`membersSee === false`). */
export function anyHidden(rows: { membersSee?: boolean }[]): boolean {
	return rows.some((r) => r.membersSee === false);
}
