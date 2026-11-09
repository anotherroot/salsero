import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { makeWorld } from '../sync/test-world';
import { viewOf } from './view';

describe('viewOf: what the connector may read is what the phone may hold', () => {
	const db = openDb(':memory:');
	const world = makeWorld(db);

	it("holds a person's own figure and their group's, never someone else's", () => {
		const v = viewOf(db, 'u1');
		expect(v.byId('figures', world.own.u1.figure)).toBeDefined();
		expect(v.byId('figures', world.group.figure)).toBeDefined();
		expect(v.byId('figures', world.own.u4.figure)).toBeUndefined();
		expect(v.byId('figures', world.otherGroup.figure)).toBeUndefined();
	});

	it("gives a plain member the group's published things, not its drafts", () => {
		const v = viewOf(db, 'u3');
		expect(v.byId('lessons', world.group.published)).toBeDefined();
		expect(v.byId('lessons', world.group.draft)).toBeUndefined();
		expect(v.byId('figures', world.group.draftFigure)).toBeUndefined();
	});

	it('names an owner: mine, or the group by name', () => {
		const v = viewOf(db, 'u1');
		expect(v.owner(v.byId('figures', world.own.u1.figure)!)).toBe('mine');
		expect(v.owner(v.byId('figures', world.group.figure)!)).toMatchObject({
			groupId: expect.any(Number),
			group: expect.any(String)
		});
	});

	it('labels a figure as "Move · Figure"', () => {
		const v = viewOf(db, 'u1');
		const fig = v.byId('figures', world.own.u1.figure)!;
		const move = v.byId('figure_groups', fig.group_id)!;
		expect(v.label(world.own.u1.figure)).toBe(`${move.name} · ${fig.name}`);
	});

	it('finds children by a column', () => {
		const v = viewOf(db, 'u1');
		expect(v.where('recordings', 'figure_id', world.own.u1.figure).map((r) => r.id)).toEqual([
			world.own.u1.recording
		]);
	});
});
