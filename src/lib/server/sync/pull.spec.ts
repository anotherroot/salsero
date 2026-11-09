import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '../db';
import { renameFigure } from '../figures';
import { deleteSet } from '../exercises';
import { leaveTeam, setRole } from '../membership';
import { createDeviceToken } from '../devices';
import { createSession, SESSION_COOKIE } from '../auth';
import { NO_FILES } from '../test-walls';
import { SYNCED } from '$lib/sync/tables';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { keyString } from '$lib/sync/digest';
import type { PullRefusal, PullRequest, PullResponse } from '$lib/sync/wire';
import { pull as rawPull, serverDigest } from './pull';
import { changedSince } from './log';
import { syncScope } from './scope';
import { makeWorld, WORLD_T, type World } from './test-world';
import { POST } from '../../../routes/api/sync/pull/+server';

let db: Db;
let w: World;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
});

function pull(userId: string, req: Partial<PullRequest> = {}): PullResponse {
	const out = rawPull(db, userId, { cursor: 0, schema: SCHEMA_TAG, ...req });
	if ('refused' in out) throw new Error('refused');
	return out;
}

/** The digests a device that applied `scope` would hold. */
function digestsOf(userId: string): Record<string, string> {
	return Object.fromEntries(
		[...syncScope(db, userId)].map(([t, rows]) => [t, serverDigest(rows.keys())])
	);
}

/** A device up to date after `first`. */
const synced = (userId: string, first: PullResponse): Partial<PullRequest> => ({
	userId,
	cursor: first.cursor,
	digests: digestsOf(userId)
});

describe('pull', () => {
	it('sends every table in full to a device with no digests', () => {
		const out = pull('u1');
		expect(out.full.sort()).toEqual(Object.keys(SYNCED).sort());
		expect(Object.keys(out.changed).sort()).toEqual(Object.keys(SYNCED).sort());
		expect(out.changed.figures.rows.length).toBeGreaterThan(0);
		expect(out.cursor).toBeGreaterThan(0);
		expect(out.userId).toBe('u1');
	});

	it('sends nothing to a device that is up to date', () => {
		const first = pull('u1');
		const again = pull('u1', synced('u1', first));
		expect(again.full).toEqual([]);
		expect(again.changed).toEqual({});
		expect(again.cursor).toBe(first.cursor);
	});

	it('sends a changed row as an upsert, not its table', () => {
		const first = pull('u1');
		expect(renameFigure(db, w.own.u1.move, 'Renamed', 'u1', WORLD_T)).toBe(true);
		const out = pull('u1', synced('u1', first));
		expect(out.full).toEqual([]);
		expect(out.changed.figure_groups.rows).toHaveLength(1);
		const cols = out.changed.figure_groups.cols;
		expect(out.changed.figure_groups.rows[0][cols.indexOf('name')]).toBe('Renamed');
		expect(out.cursor).toBeGreaterThan(first.cursor);
	});

	it("never sends a change to another person's row", () => {
		const first = pull('u1');
		expect(renameFigure(db, w.own.u4.move, 'Nik only', 'u4', WORLD_T)).toBe(true);
		const out = pull('u1', synced('u1', first));
		expect(out.changed.figure_groups).toBeUndefined();
		expect(out.changed.figures).toBeUndefined();
		expect(out.full).toEqual([]);
	});

	it("drops a left group's rows on the next pull", async () => {
		const first = pull('u3');
		const lessonsBefore = first.changed.lessons;
		const id = lessonsBefore.cols.indexOf('id');
		expect(lessonsBefore.rows.some((r) => r[id] === w.group.published)).toBe(true);
		const held = synced('u3', first);
		await leaveTeam(db, 1, 'u3', { mode: 'used' }, NO_FILES, WORLD_T);
		const out = pull('u3', held);
		expect(out.full).toContain('lessons');
		expect(out.changed.lessons.rows.some((r) => r[id] === w.group.published)).toBe(false);
	});

	it('resends a table whose row was deleted', () => {
		const first = pull('u1');
		// The device's digests are of what it held before the delete.
		const held = synced('u1', first);
		expect(deleteSet(db, w.own.u1.set)).toBe(true);
		const out = pull('u1', held);
		expect(out.full).toContain('sets');
		expect(out.full).not.toContain('figures');
	});

	it('starts over when the cursor is past the head or pruned away', () => {
		const first = pull('u1');
		const ok = synced('u1', first);
		expect(pull('u1', { ...ok, cursor: first.cursor + 5 }).full).toHaveLength(
			Object.keys(SYNCED).length
		);
		db.run(sql`DELETE FROM change_log WHERE seq < ${first.cursor - 2}`);
		expect(pull('u1', { ...ok, cursor: 3 }).full).toHaveLength(Object.keys(SYNCED).length);
		// Not pruned past it: a cursor at the oldest-1 is still fine.
		const oldest = db.get<{ s: number }>(sql`SELECT min(seq) AS s FROM change_log`).s;
		expect(pull('u1', { ...ok, cursor: oldest - 1 }).full).toEqual([]);
		// An emptied log with the cursor behind the head starts over too.
		db.run(sql`DELETE FROM change_log`);
		expect(pull('u1', { ...ok, cursor: 3 }).full).toHaveLength(Object.keys(SYNCED).length);
		expect(pull('u1', ok).full).toEqual([]);
	});

	it("starts over for a copy that is another person's, or does not say whose", () => {
		// Luka (u2) and Maja (u3) share group 1: some tables hold the same keys for both.
		const first = pull('u2');
		const held = synced('u2', first);
		const all = Object.keys(SYNCED).sort();
		expect(pull('u3', held).full.sort()).toEqual(all);
		expect(pull('u2', { ...held, userId: null }).full.sort()).toEqual(all);
		const { userId: _, ...unsaid } = held;
		void _;
		expect(pull('u2', unsaid).full.sort()).toEqual(all);
		expect(pull('u2', held).full).toEqual([]);
	});

	it('refuses another schema', () => {
		expect(rawPull(db, 'u1', { cursor: 0, schema: 'nope' })).toEqual({
			refused: 'schema',
			schema: SCHEMA_TAG
		} satisfies PullRefusal);
	});

	it('answers columns in schema order and rows as arrays', () => {
		const out = pull('u1');
		const cols = db
			.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('figures')`)
			.map((c) => c.name);
		expect(out.changed.figures.cols).toEqual(cols);
		for (const r of out.changed.figures.rows) expect(r).toHaveLength(cols.length);
		const idCol = cols.indexOf('id');
		expect(out.changed.figures.rows.some((r) => r[idCol] === w.own.u1.figure)).toBe(true);
	});

	it("tells an editor's demotion in the team row: the code is hidden", () => {
		const first = pull('u2');
		const teams = first.changed.teams;
		const code = teams.cols.indexOf('code');
		const idc = teams.cols.indexOf('id');
		const before = teams.rows.find((r) => r[idc] === 1)!;
		expect(before[code]).not.toBe('hidden-1');
		expect(setRole(db, 1, 'u2', 'member', WORLD_T)).toBe(true);
		const out = pull('u2', synced('u2', first));
		const row = out.changed.teams.rows.find((r) => r[idc] === 1)!;
		expect(row[code]).toBe('hidden-1');
	});

	it('finds a changed row by its log key in the scope map, whatever the key shape', () => {
		const cursor = pull('u1').cursor;
		// A composite key (lesson_figures) and an integer key (figure_groups).
		db.run(sql`UPDATE lesson_figures SET lesson_id = lesson_id`);
		db.run(sql`UPDATE default_styles SET dance = dance`);
		db.run(sql`UPDATE figure_groups SET name = name WHERE id = ${w.own.u1.move}`);
		const scope = syncScope(db, 'u1');
		const keys = changedSince(db, cursor);
		const seen = new Set(keys.map((k) => k.tbl));
		expect(seen.has('figure_groups')).toBe(true);
		expect(scope.get('figure_groups')!.has(String(w.own.u1.move))).toBe(true);
		expect(keys.some((k) => k.tbl === 'figure_groups' && k.key === String(w.own.u1.move))).toBe(
			true
		);
		// Every composite-key log key that is in u1's scope is found under keyString.
		const lf = db.all<{ lesson_id: number; figure_id: number }>(
			sql`SELECT lesson_id, figure_id FROM lesson_figures`
		);
		const mine = lf.filter((r) =>
			scope.get('lesson_figures')!.has(keyString([r.lesson_id, r.figure_id]))
		);
		expect(mine.length).toBeGreaterThan(0);
		for (const r of mine) {
			expect(
				keys.some(
					(k) => k.tbl === 'lesson_figures' && k.key === keyString([r.lesson_id, r.figure_id])
				)
			).toBe(true);
		}
	});
});

describe('POST /api/sync/pull', () => {
	function call(opts: { cookies?: Record<string, string>; body?: unknown; user?: boolean }) {
		const jar = opts.cookies ?? {};
		const request = new Request('http://x/api/sync/pull', {
			method: 'POST',
			body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? {})
		});
		const cookies = { get: (n: string) => jar[n] };
		const locals = { user: opts.user ? { id: 'u1' } : null };
		return (POST as unknown as (e: unknown) => Promise<Response>)({ request, cookies, locals });
	}
	const body = { cursor: 0, schema: SCHEMA_TAG };

	it('refuses a request without a session, and a device token', async () => {
		expect((await call({ body })).status).toBe(401);
		// The hook signs a device token in as locals.user; the cookie is what counts.
		const { token } = createDeviceToken(db, 'u1', 'phone', WORLD_T);
		expect(token).toBeTruthy();
		expect((await call({ body, user: true })).status).toBe(401);
	});

	// The group cookies are gone (the group view is in the address): an old one is not echoed.
	it('echoes the page cookies and never the session', async () => {
		db.run(sql`UPDATE users SET dance = 'salsa' WHERE id = 'u1'`);
		const session = createSession('u1', db).id;
		const res = await call({
			body,
			cookies: {
				[SESSION_COOKIE]: session,
				theme: 'dark',
				salsa_app: 'android',
				lang: 'sl',
				group_salsa: '1',
				group_bachata: '2',
				other: 'x'
			}
		});
		expect(res.status).toBe(200);
		const out = (await res.json()) as PullResponse;
		expect(out.cookies).toEqual({
			theme: 'dark',
			salsa_app: 'android',
			lang: 'sl'
		});
		expect(out.userId).toBe('u1');
	});

	it('answers 409 for another schema and 400 for a malformed body', async () => {
		db.run(sql`UPDATE users SET dance = 'salsa' WHERE id = 'u1'`);
		const session = createSession('u1', db).id;
		const cookies = { [SESSION_COOKIE]: session };
		const r409 = await call({ cookies, body: { cursor: 0, schema: 'nope' } });
		expect(r409.status).toBe(409);
		expect(await r409.json()).toEqual({ refused: 'schema', schema: SCHEMA_TAG });
		expect((await call({ cookies, body: 'not json' })).status).toBe(400);
		expect((await call({ cookies, body: { cursor: 'x', schema: SCHEMA_TAG } })).status).toBe(400);
		expect(
			(await call({ cookies, body: { cursor: 0, schema: SCHEMA_TAG, digests: { a: 1 } } })).status
		).toBe(400);
		expect((await call({ cookies, body: { ...body, userId: 7 } })).status).toBe(400);
		expect((await call({ cookies, body: { ...body, userId: null } })).status).toBe(200);
	});

	it("takes the copy's person: the same one gets changes only", async () => {
		db.run(sql`UPDATE users SET dance = 'salsa' WHERE id = 'u1'`);
		const cookies = { [SESSION_COOKIE]: createSession('u1', db).id };
		const first = (await (await call({ cookies, body })).json()) as PullResponse;
		const again = await call({ cookies, body: { ...synced('u1', first), schema: SCHEMA_TAG } });
		expect(((await again.json()) as PullResponse).full).toEqual([]);
	});
});
