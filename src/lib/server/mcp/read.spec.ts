import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { makeWorld } from '../sync/test-world';
import { readTools } from './read';
import type { ToolCtx } from './modules';

const db = openDb(':memory:');
const world = makeWorld(db);
const ctx = (userId: string): ToolCtx => ({ db, userId, dance: 'salsa', grantId: 1, now: 0 });
const run = async (name: string, args: Record<string, unknown>, userId = 'u1') => {
	const r = await readTools.impls[name](args, ctx(userId));
	return { ...r, data: r.isError ? null : JSON.parse(r.text) };
};

describe('the read tools', () => {
	it('every def reads only, refuses unknown keys, and has an impl', () => {
		for (const d of readTools.defs) {
			expect(d.annotations, d.name).toEqual({
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false
			});
			expect(
				(d.inputSchema as { additionalProperties?: boolean }).additionalProperties,
				d.name
			).toBe(false);
			expect(readTools.impls[d.name], d.name).toBeTypeOf('function');
		}
		expect(readTools.defs.map((d) => d.name).sort()).toEqual(
			[
				'get_drill',
				'get_figure',
				'get_lesson',
				'get_move',
				'get_position',
				'get_routine',
				'list',
				'list_groups',
				'search',
				'vocabulary'
			].sort()
		);
	});

	it('search finds the person`s own move, never another person`s', async () => {
		const r = await run('search', { query: 'enchufla' });
		const names = (r.data.items as { name: string }[]).map((i) => i.name);
		expect(names.some((n) => n.includes('u1'))).toBe(true);
		expect(names.some((n) => n.includes('u4'))).toBe(false);
	});

	it('search ignores case and accents', async () => {
		const a = await run('search', { query: 'ENCHUFLÁ U1' });
		expect((a.data.items as unknown[]).length).toBeGreaterThan(0);
	});

	it('another person`s id, another group`s id and a missing id answer the same', async () => {
		const texts = await Promise.all(
			[world.own.u4.figure, world.otherGroup.figure, 999999].map(
				async (id) => (await run('get_figure', { id })).text
			)
		);
		expect(texts[0]).toBe(
			`No figure with id ${world.own.u4.figure}. Ids come from search or list.`
		);
		expect(texts[1]).toBe(
			texts[0].replace(String(world.own.u4.figure), String(world.otherGroup.figure))
		);
		expect(texts[2]).toBe(texts[0].replace(String(world.own.u4.figure), '999999'));
	});

	it('a plain member cannot read a group draft', async () => {
		expect((await run('get_lesson', { id: world.group.draft }, 'u3')).isError).toBe(true);
		expect((await run('get_lesson', { id: world.group.published }, 'u3')).isError).toBe(false);
	});

	it('get_lesson lists its videos` sections in ms, and what it links', async () => {
		const own = await run('get_lesson', { id: world.own.u1.lesson });
		expect(own.data.videos[0].sections[0]).toMatchObject({
			label: 'Part',
			start_ms: 0,
			end_ms: 2000
		});
		const pub = await run('get_lesson', { id: world.group.published });
		expect(pub.data.owner).toMatchObject({ group: expect.any(String) });
		expect(pub.data.published).toBe(true);
		expect(pub.data.figures.map((f: { id: number }) => f.id)).toContain(world.group.figure);
	});

	it('get_figure gives its move, timing, positions and recordings with sections', async () => {
		const r = await run('get_figure', { id: world.own.u1.figure });
		expect(r.data.label).toContain(' · ');
		expect(r.data.length_counts).toBe(8);
		expect(r.data.starts).toEqual([`Cerrada u1`]);
		expect(r.data.recordings[0].sections[0]).toMatchObject({
			label: 'Turn',
			start_ms: 0,
			end_ms: 1000
		});
		expect(r.data.routines.map((x: { id: number }) => x.id)).toContain(world.own.u1.routine);
	});

	it('list hides archived lessons unless asked', async () => {
		const ids = async (args: Record<string, unknown>) =>
			((await run('list', args)).data.items as { id: number }[]).map((i) => i.id);
		expect(await ids({ kind: 'lesson' })).not.toContain(world.group.archived);
		expect(await ids({ kind: 'lesson', include_archived: true })).toContain(world.group.archived);
	});

	it('list_groups names the person`s groups with their role', async () => {
		const r = await run('list_groups', {});
		expect(r.data.groups).toEqual(
			expect.arrayContaining([expect.objectContaining({ role: 'owner' })])
		);
	});

	it('vocabulary holds the person`s own words', async () => {
		const r = await run('vocabulary', {});
		expect(r.data.positions).toContain('Cerrada u1');
		expect(r.data.sections).toContain('Turn');
	});

	it('refuses a string id and an unknown key with one line to correct', async () => {
		const a = await run('get_move', { id: '5' });
		expect(a.isError).toBe(true);
		expect(a.text).toMatch(/id must be/);
		const b = await run('get_move', { id: 5, extra: 1 });
		expect(b.text).toMatch(/Unknown argument "extra"/);
		const c = await run('list', { kind: 'song' });
		expect(c.text).toMatch(/kind must be one of/);
	});
});
