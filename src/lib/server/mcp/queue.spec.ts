import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { makeWorld, type World } from '../sync/test-world';
import { queueTools } from './queue';
import type { ToolCtx } from './modules';
import { INSTRUCTIONS } from '$lib/mcp/protocol';
import { approve } from '../oauth/store';

/** The queue's own tables, and the id bookkeeping their triggers keep (`id_marks`). */
const QUEUE_TABLES = ['ai_groups', 'ai_actions', 'ai_lines', 'id_marks'];

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	const w = makeWorld(db);
	// The connection the AI asks through (ai_actions.grant_id points at it).
	approve(
		db,
		{
			userId: 'u1',
			clientId: 'https://claude.ai/meta',
			clientName: 'Claude',
			redirectUri: 'https://claude.ai/cb',
			codeChallenge: 'x'.repeat(43)
		},
		0
	);
	return { db, w };
}
const ctx = (db: Db): ToolCtx => ({
	db,
	userId: 'u1',
	dance: 'salsa',
	grantId: 1,
	now: 1_800_000_000_000
});
const call = async (db: Db, name: string, args: Record<string, unknown>) => {
	const r = await queueTools.impls[name](args, ctx(db));
	return { ...r, data: r.isError ? null : JSON.parse(r.text) };
};

/** Row counts of every table but SQLite's own. */
function counts(db: Db): Record<string, number> {
	const tables = db.all<{ name: string }>(
		sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'`
	);
	return Object.fromEntries(
		tables.map((t) => [
			t.name,
			db.get<{ n: number }>(sql`select count(*) as n from ${sql.identifier(t.name)}`)!.n
		])
	);
}
const without = (c: Record<string, number>) =>
	Object.fromEntries(Object.entries(c).filter(([k]) => !QUEUE_TABLES.includes(k)));

describe('the queue tools', () => {
	it('are the seven, write only the queue, and refuse unknown keys', () => {
		const names = queueTools.defs.map((d) => d.name).sort();
		expect(names).toEqual([
			'change_action',
			'move_action',
			'propose',
			'queue',
			'remove_group',
			'set_group',
			'withdraw_action'
		]);
		for (const d of queueTools.defs) {
			expect(
				(d.inputSchema as { additionalProperties?: boolean }).additionalProperties,
				d.name
			).toBe(false);
			expect(d.annotations.destructiveHint, d.name).toBe(false);
			expect(d.annotations.readOnlyHint, d.name).toBe(d.name === 'queue');
		}
	});

	it('every write tool, used as the AI would, changes no table but the queue`s', async () => {
		const { db, w } = setup();
		const before = without(counts(db));
		const a = await call(db, 'propose', {
			group_title: 'Spelling',
			title: 'Fix the routine notes',
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'Slow on 5' }]
		});
		expect(a.isError).toBe(false);
		const b = await call(db, 'propose', {
			group_id: a.data.group_id,
			title: 'New section',
			lines: [
				{
					kind: 'add_section',
					lesson_video_id: w.own.u1.video,
					start_ms: 1000,
					end_ms: 2000,
					label: 'Guapea'
				}
			]
		});
		expect(
			(await call(db, 'change_action', { id: b.data.action_id, title: 'A section' })).isError
		).toBe(false);
		expect(
			(await call(db, 'move_action', { id: b.data.action_id, before_id: a.data.action_id })).isError
		).toBe(false);
		const g = await call(db, 'set_group', { title: 'Sections' });
		expect(
			(await call(db, 'move_action', { id: b.data.action_id, group_id: g.data.group_id })).isError
		).toBe(false);
		expect((await call(db, 'withdraw_action', { id: a.data.action_id })).isError).toBe(false);
		expect((await call(db, 'remove_group', { id: g.data.group_id })).isError).toBe(false);
		expect(without(counts(db))).toEqual(before);
	});

	it('propose names the kinds when given an unknown one, and refuses what the person cannot do', async () => {
		const { db, w } = setup();
		const unknown = await call(db, 'propose', {
			group_title: 'G',
			title: 'x',
			lines: [{ kind: 'delete_everything' }]
		});
		expect(unknown.isError).toBe(true);
		expect(unknown.text).toMatch(/edit_figure/);
		const notMine = await call(db, 'propose', {
			group_title: 'G',
			title: 'x',
			lines: [{ kind: 'edit_figure', figure_id: w.own.u4.figure, notes: 'x' }]
		});
		expect(notMine.text).toMatch(/that you can edit/);
	});

	it('queue shows the actions with their lines and states', async () => {
		const { db, w } = setup();
		await call(db, 'propose', {
			group_title: 'G',
			title: 'T',
			lines: [{ kind: 'edit_routine', routine_id: w.own.u1.routine, notes: 'x' }]
		});
		const q = await call(db, 'queue', {});
		expect(q.data.groups[0].actions[0]).toMatchObject({
			n: 1,
			title: 'T',
			state: 'pending',
			lines: [{ kind: 'edit_routine', status: 'pending' }]
		});
	});

	it('the instructions tell the AI it now proposes, and how', () => {
		expect(INSTRUCTIONS).toMatch(/propose/);
		expect(INSTRUCTIONS).not.toMatch(/reads only/);
	});
});
