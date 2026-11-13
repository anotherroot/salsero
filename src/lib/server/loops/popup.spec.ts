import { describe, expect, it } from 'vitest';
import { openDb } from '../db';
import { makeWorld } from '../sync/test-world';
import { CLASS_ED } from '../test-class';
import { linkInSpace } from '../spot-links';
import { linkOptionsFor } from '../link-popup';

describe("a group's Link popup: pictures read as the editor (review)", () => {
	it("an editor sees the group's figure with its picture", () => {
		const db = openDb(':memory:');
		const w = makeWorld(db);
		linkInSpace(db, CLASS_ED, w.group.spot, { figureId: w.group.figure });
		const o = linkOptionsFor(db, w.group.spot, 'u2')!;
		const row = [...o.near, ...o.figures].find(
			(x) => 'figureId' in x.target && x.target.figureId === w.group.figure
		)!;
		expect(row.look?.picture?.strip).toBe(`/loops/${w.group.spot}-0-1000.jpg`);
	});
});
