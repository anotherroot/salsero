import { describe, expect, it } from 'vitest';
import { undoAddSteps } from './picks';

describe('undoAddSteps', () => {
	it('takes away the pick the + made', () =>
		expect(undoAddSteps(7, { pickIds: [40], unskipped: [] })).toEqual([
			{ action: 'unpick', fields: { pickId: 40 } }
		]));

	it('skips again what the + un-skipped, before taking its pick away', () =>
		expect(undoAddSteps(7, { pickIds: [40], unskipped: [7] })).toEqual([
			{ action: 'pick', fields: { exerciseId: 7, kind: 'skip' } },
			{ action: 'unpick', fields: { pickId: 40 } }
		]));

	it('only skips again when the + made no pick (one was there already)', () =>
		expect(undoAddSteps(7, { pickIds: [], unskipped: [7] })).toEqual([
			{ action: 'pick', fields: { exerciseId: 7, kind: 'skip' } }
		]));

	it('nothing to undo: no steps (the toast offers no Undo)', () => {
		expect(undoAddSteps(7, { pickIds: [], unskipped: [] })).toEqual([]);
		expect(undoAddSteps(7, {})).toEqual([]);
	});
});
