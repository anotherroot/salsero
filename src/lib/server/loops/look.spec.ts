import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, recordings } from '../db/schema';
import { makeWorld, type World } from '../sync/test-world';
import { CLASS_ED } from '../test-class';
import { linkInSpace } from '../spot-links';
import { figureSheet, moveSheet } from './look';

const u = (id: string, dance: 'salsa' | 'bachata' = 'salsa') => ({ id, dance });

function setup(): { db: Db; w: World } {
	const db = openDb(':memory:');
	return { db, w: makeWorld(db) };
}

describe('figureSheet', () => {
	it("the owner's: label, notes, positions, counts, mine, and the row's section as the video", () => {
		const { db, w } = setup();
		db.update(figures)
			.set({ notes: 'On 1 2 3 you pull her in' })
			.where(eq(figures.id, w.own.u1.figure))
			.run();
		const file = db.select().from(recordings).where(eq(recordings.id, w.own.u1.recording)).get()!
			.file;
		const s = figureSheet(db, u('u1'), w.own.u1.figure, w.own.u1.spot)!;
		expect(s).toMatchObject({
			id: w.own.u1.figure,
			label: 'Enchufla u1 · Basic',
			notes: 'On 1 2 3 you pull her in',
			starts: ['Cerrada u1'],
			ends: ['Cerrada u1'],
			startCount: '1',
			length: 8,
			from: { kind: 'mine' },
			video: { src: `/recordings/${file}`, startMs: 0, endMs: 1000, from: { kind: 'recording' } },
			picture: {
				clip: `/loops/${w.own.u1.spot}-0-1000.mp4`,
				still: `/loops/${w.own.u1.spot}-0-1000-still.jpg`
			}
		});
	});

	it('no video for a section not linked to it, or none asked for', () => {
		const { db, w } = setup();
		expect(figureSheet(db, u('u1'), w.own.u1.figure, w.own.u1.videoSpot)!.video).toBeNull();
		expect(figureSheet(db, u('u1'), w.own.u1.figure, null)!.video).toBeNull();
	});

	it("another person's, a missing one and another dance's: all null", () => {
		const { db, w } = setup();
		expect(figureSheet(db, u('u4'), w.own.u1.figure, null)).toBeNull();
		expect(figureSheet(db, u('u1'), 99999, null)).toBeNull();
		expect(figureSheet(db, u('u1', 'bachata'), w.own.u1.figure, null)).toBeNull();
	});

	it("a group's: a reader reads it as the group's, never a draft's figure or a draft's section", () => {
		const { db, w } = setup();
		expect(figureSheet(db, u('u3'), w.group.figure, null)!.from).toEqual({
			kind: 'group',
			name: 'Salsa Tuesdays',
			readOnly: true
		});
		expect(figureSheet(db, u('u2'), w.group.figure, null)!.from).toMatchObject({ readOnly: false });
		expect(figureSheet(db, u('u3'), w.group.draftFigure, null)).toBeNull();
		linkInSpace(db, CLASS_ED, w.group.draftSpot, { figureId: w.group.figure });
		expect(figureSheet(db, u('u3'), w.group.figure, w.group.draftSpot)!.video).toBeNull();
		expect(figureSheet(db, u('u2'), w.group.figure, w.group.draftSpot)!.video).toMatchObject({
			from: { kind: 'lesson', title: 'Draft' }
		});
	});
});

describe('moveSheet', () => {
	it('the move and its live variations, each with its look', () => {
		const { db, w } = setup();
		const move = w.own.u1.move;
		const s = moveSheet(db, u('u1'), move)!;
		expect(s.name).toBe('Enchufla u1');
		expect(s.variations).toEqual([
			{
				id: w.own.u1.figure,
				name: 'Basic',
				look: expect.objectContaining({ hands: 'Cerrada u1 → Cerrada u1', length: 8 })
			}
		]);
		expect(moveSheet(db, u('u4'), move)).toBeNull();
	});
});
