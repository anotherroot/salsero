/**
 * The dance split at boot: every account belongs to one dance
 * (`docs/superpowers/specs/2026-11-06-dance-split-design.md`). An account
 * the split has not placed (`users.dance` NULL) is placed in the dance it
 * uses. One that uses both keeps salsa, and its bachata half moves to a new
 * bachata account with the same email, password and settings. Idempotent:
 * placed accounts are never looked at again. Runs before the boot admin and
 * before any request, so no session ever sees an unplaced account.
 */
import { randomUUID } from 'node:crypto';
import { eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { countTakes, users } from './db/schema';
import type { CloneFiles } from './clones/files';
import type { DanceSlug } from '$lib/dances/dances';

/** Root tables a person owns, each carrying `dance`. */
const ROOTS = [
	'figure_groups',
	'figures',
	'positions',
	'routines',
	'songs',
	'exercises',
	'lessons'
] as const;

/** The label pairing gives the bachata app; every other label is salsa's (paired before flavors). */
const BACHATA_APP_LABEL = 'Bachata app';

const BACHATA_TEAMS = sql.raw(`(select id from teams where dance = 'bachata')`);
const BACHATA_LESSONS = sql.raw(`(select id from lessons where dance = 'bachata')`);
const of = (table: string) => sql.raw(`(select id from ${table} where dance = 'bachata')`);

/** The dances an account uses: what it owns, its groups, its apps, its style choices. */
function dancesOf(db: Db, userId: string): Set<string> {
	const parts: SQL[] = [
		...ROOTS.map((t) => sql`select dance from ${sql.identifier(t)} where user_id = ${userId}`),
		sql`select t.dance from team_members m join teams t on t.id = m.team_id where m.user_id = ${userId}`,
		sql`select dance from app_installs where user_id = ${userId}`,
		sql`select dance from default_styles where user_id = ${userId}`
	];
	const rows = db.all<{ dance: string }>(sql.join(parts, sql` union `));
	return new Set(rows.map((r) => r.dance));
}

/** Every statement moving a row of the person's from `old` to `neu` when it is bachata's. */
function moves(neu: string, old: string): SQL[] {
	return [
		...ROOTS.map(
			(t) =>
				sql`update ${sql.identifier(t)} set user_id = ${neu} where user_id = ${old} and dance = 'bachata'`
		),
		sql`update today_picks set user_id = ${neu} where user_id = ${old}
		    and exercise_id in ${of('exercises')}`,
		sql`update default_styles set user_id = ${neu} where user_id = ${old} and dance = 'bachata'`,
		sql`update app_installs set user_id = ${neu} where user_id = ${old} and dance = 'bachata'`,
		sql`update team_members set user_id = ${neu} where user_id = ${old} and team_id in ${BACHATA_TEAMS}`,
		sql`update teams set created_by = ${neu} where created_by = ${old} and dance = 'bachata'`,
		sql`update teams set deleted_by = ${neu} where deleted_by = ${old} and dance = 'bachata'`,
		sql`update team_changes set actor_id = ${neu} where actor_id = ${old} and team_id in ${BACHATA_TEAMS}`,
		sql`update team_trash set deleted_by = ${neu} where deleted_by = ${old} and team_id in ${BACHATA_TEAMS}`,
		sql`update storage_requests set user_id = ${neu} where user_id = ${old} and team_id in ${BACHATA_TEAMS}`,
		sql`update lesson_adds set user_id = ${neu} where user_id = ${old} and lesson_id in ${BACHATA_LESSONS}`,
		sql`update opens set user_id = ${neu} where user_id = ${old} and (
		      (kind in ('lesson', 'comments') and item_id in ${BACHATA_LESSONS})
		      or (kind = 'song' and item_id in ${of('songs')}))`,
		sql`update twins set user_id = ${neu} where user_id = ${old} and (
		      (kind = 'figure' and item_id in ${of('figures')})
		      or (kind = 'routine' and item_id in ${of('routines')})
		      or (kind = 'lesson' and item_id in ${BACHATA_LESSONS})
		      or (kind = 'song' and item_id in ${of('songs')})
		      or (kind = 'position' and item_id in ${of('positions')}))`,
		sql`update video_downloads set requested_by = ${neu} where requested_by = ${old}
		    and (figure_id in ${of('figures')} or lesson_id in ${BACHATA_LESSONS})`,
		sql`update lesson_comments set author_id = ${neu} where author_id = ${old}
		    and lesson_id in ${BACHATA_LESSONS}`,
		sql`update lesson_comments set deleted_by = ${neu} where deleted_by = ${old}
		    and lesson_id in ${BACHATA_LESSONS}`,
		sql`update lesson_comment_hearts set user_id = ${neu} where user_id = ${old}
		    and comment_id in (select id from lesson_comments where lesson_id in ${BACHATA_LESSONS})`,
		sql`update device_tokens set user_id = ${neu} where user_id = ${old} and label = ${BACHATA_APP_LABEL}`
	];
}

export async function splitAccounts(
	db: Db,
	files: CloneFiles,
	now: number
): Promise<{ assigned: number; split: number; failed: number }> {
	let assigned = 0;
	let split = 0;
	let failed = 0;
	for (const user of db.select().from(users).where(isNull(users.dance)).all()) {
		const dances = dancesOf(db, user.id);
		if (dances.size <= 1) {
			const dance = ([...dances][0] ?? 'salsa') as DanceSlug;
			db.update(users).set({ dance }).where(eq(users.id, user.id)).run();
			assigned++;
			continue;
		}
		// Both dances. The takes' files are linked first: a file operation cannot
		// sit in the synchronous transaction. Unlinked again if it throws.
		const all = db.select().from(countTakes).where(eq(countTakes.userId, user.id)).all();
		const takes: typeof all = [];
		const copies: string[] = [];
		try {
			for (const t of all) {
				// A take whose file is gone is left out of the copy, not the split:
				// a failed split would leave the account signing in nowhere.
				try {
					copies.push(await files.link('count', t.file));
					takes.push(t);
				} catch (err) {
					console.warn(`[accounts] take ${t.file} of ${user.id} not copied`, err);
				}
			}
			db.transaction((tx) => {
				const neu = randomUUID();
				tx.update(users).set({ dance: 'salsa' }).where(eq(users.id, user.id)).run();
				tx.insert(users)
					.values({ ...user, id: neu, dance: 'bachata', createdAt: now })
					.run();
				for (const q of moves(neu, user.id)) tx.run(q);
				takes.forEach((t, i) => {
					tx.insert(countTakes)
						.values({ ...t, id: undefined, userId: neu, file: copies[i] })
						.run();
				});
			});
			split++;
		} catch (err) {
			// One person's failure must not keep the site down (the boot awaits this):
			// the account stays unplaced, so it signs in nowhere, and the next boot
			// tries again. Logged for a person to look at.
			for (const c of copies) await files.unlink('count', c);
			console.warn(`[accounts] splitting ${user.id} failed`, err);
			failed++;
		}
	}
	return { assigned, split, failed };
}
