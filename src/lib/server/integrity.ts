import { sql } from 'drizzle-orm';
import type { Db } from './db';

/** Root tables owned by exactly one of a person (`user_id`) or a team (`team_id`). */
const ROOTS = ['figure_groups', 'figures', 'routines', 'exercises', 'lessons'] as const;

/**
 * What is wrong with who owns what, one line each. Empty when whole. Called at
 * boot, which only logs it; it reads and reports, never throws on bad data.
 */
export function ownerIntegrity(db: Db): string[] {
	const lines: string[] = [];
	const all = (q: string) => db.all<Record<string, unknown>>(sql.raw(q));

	for (const t of ROOTS) {
		for (const r of all(
			`select id from ${t} where (user_id is null) = (team_id is null) order by id`
		)) {
			lines.push(`${t} ${r.id}: needs exactly one of user_id and team_id`);
		}
	}
	for (const t of ROOTS) {
		for (const r of all(
			`select r.id, r.dance, tm.dance as team_dance from ${t} r join teams tm on tm.id = r.team_id
			 where r.dance <> tm.dance order by r.id`
		)) {
			lines.push(`${t} ${r.id}: dance ${r.dance} differs from its team's ${r.team_dance}`);
		}
	}
	for (const r of all(
		`select f.id, f.user_id, f.team_id, g.user_id as g_user, g.team_id as g_team
		 from figures f join figure_groups g on g.id = f.group_id
		 where f.user_id is not g.user_id or f.team_id is not g.team_id order by f.id`
	)) {
		lines.push(`figures ${r.id}: owner differs from its figure group's`);
	}
	for (const r of all(
		`select id from exercises where source in ('lesson', 'routine', 'figure', 'added')
		 and user_id is null order by id`
	)) {
		lines.push(`exercises ${r.id}: an entry with no user_id`);
	}
	return lines;
}
