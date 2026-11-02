import { readdirSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import {
	countTakes,
	exercises,
	figureGroups,
	figures,
	lessons,
	routines,
	songs,
	users
} from './db/schema';

/** The UPDATE statements of the accounts migration (0019): the backfill. */
function backfillSql(): string[] {
	const file = readdirSync('drizzle').find((f) => f.startsWith('0019_') && f.endsWith('.sql'));
	if (!file) throw new Error('no 0019 migration');
	return readFileSync(`drizzle/${file}`, 'utf8')
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter((s) => s.startsWith('UPDATE'));
}

const take = (userId: string | null, bpm = 100) => ({
	userId,
	pattern: 'salsa-1-8' as never,
	bpm,
	phrase: 'a' as const,
	file: `${Math.random()}.wav`,
	sampleRate: 48000,
	preRollS: 0.1,
	lengthS: 1,
	durationS: 1.2,
	sizeBytes: 10
});

describe('accounts migration', () => {
	it('backfills every root row to the first user and makes them the admin', () => {
		const db = openDb(':memory:');
		db.insert(users).values({ id: 'first', email: 'a@x.com', passwordHash: 'x' }).run();
		db.insert(users).values({ id: 'second', email: 'b@x.com', passwordHash: 'x' }).run();
		db.insert(figureGroups).values({ dance: 'salsa', name: 'G' }).run();
		db.insert(figures).values({ name: 'F' }).run();
		db.insert(exercises)
			.values({ name: 'E', source: 'custom', everyDays: 3 } as never)
			.run();
		db.insert(lessons).values({ lessonDay: '2026-01-01', title: 'L' }).run();
		db.insert(routines).values({ name: 'R' }).run();
		db.insert(songs)
			.values({ status: 'ready', audioFile: 'a.mp3' } as never)
			.run();
		db.insert(countTakes).values(take(null)).run();

		for (const s of backfillSql()) db.run(sql.raw(s));

		for (const t of [
			'figure_groups',
			'figures',
			'exercises',
			'lessons',
			'routines',
			'songs',
			'count_takes'
		]) {
			const rows = db.all<{ user_id: string | null }>(sql.raw(`select user_id from ${t}`));
			expect(rows.length, t).toBe(1);
			expect(rows[0].user_id, t).toBe('first');
		}
		const admins = db.all<{ id: string; is_admin: number }>(
			sql.raw('select id, is_admin from users order by rowid')
		);
		expect(admins.map((u) => u.is_admin)).toEqual([1, 0]);
	});

	it('keeps count takes unique per user, not globally', () => {
		const db = openDb(':memory:');
		db.insert(countTakes).values(take('u1')).run();
		db.insert(countTakes).values(take('u2')).run();
		expect(() => db.insert(countTakes).values(take('u1')).run()).toThrow();
	});
});
