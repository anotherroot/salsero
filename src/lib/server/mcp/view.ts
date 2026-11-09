/**
 * What the AI connector reads: one person's rows, exactly the set their phone
 * may hold offline (`syncScope`), so the connector cannot read past what the
 * person may read. Built once per tool call; no query here touches a content
 * table on its own. Rows keep their stored (snake_case) column names.
 */
import type { Db } from '../db';
import { syncScope, type Row } from '../sync/scope';
import { labelFor } from '../figures';

export type { Row };
/** Whose a row is, as the AI is told: the person's own, or a group's by name. */
export type Owner = 'mine' | { group: string; groupId: number };

export interface View {
	/** Every row of a synced table the person may read. */
	rows(table: string): Row[];
	/** One row by its integer id, or undefined (missing, or not the person's to read). */
	byId(table: string, id: unknown): Row | undefined;
	/** The rows of `table` whose `column` equals `value`. */
	where(table: string, column: string, value: unknown): Row[];
	owner(row: Row): Owner;
	/** A figure as the app names it: "Move · Figure". */
	label(figureId: unknown): string;
}

export function viewOf(db: Db, userId: string): View {
	const scope = syncScope(db, userId);
	const tableOf = (table: string) => scope.get(table) ?? new Map<string, Row>();
	const rows = (table: string) => [...tableOf(table).values()];
	const byId = (table: string, id: unknown) =>
		typeof id === 'number' && Number.isInteger(id) ? tableOf(table).get(String(id)) : undefined;
	return {
		rows,
		byId,
		where: (table, column, value) => rows(table).filter((r) => r[column] === value),
		owner: (row) => {
			if (row.team_id === null || row.team_id === undefined) return 'mine';
			const team = byId('teams', row.team_id);
			return { group: String(team?.name ?? ''), groupId: Number(row.team_id) };
		},
		label: (figureId) => {
			const fig = byId('figures', figureId);
			if (!fig) return '';
			const move = byId('figure_groups', fig.group_id);
			return move ? labelFor(String(move.name), String(fig.name)) : String(fig.name);
		}
	};
}
