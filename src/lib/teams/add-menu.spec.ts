import { describe, expect, it } from 'vitest';
import { ADD_KINDS, addPath, chooserShown } from './add-menu';

describe('Add to the group', () => {
	it('lists the six kinds in order', () => {
		expect(ADD_KINDS.map((k) => k.kind)).toEqual([
			'lesson',
			'music',
			'figure',
			'routine',
			'position',
			'drill'
		]);
	});

	it('sends the four lists to their create sheet; lesson and drill stay on the page', () => {
		expect(addPath('music', 'salsa')).toBe('/salsa/songs?add=1');
		expect(addPath('figure', 'salsa')).toBe('/salsa/figures?new=1');
		expect(addPath('routine', 'bachata')).toBe('/bachata/routines?new=1');
		expect(addPath('position', 'salsa')).toBe('/salsa/positions?new=1');
		expect(addPath('lesson', 'salsa')).toBeNull();
		expect(addPath('drill', 'salsa')).toBeNull();
	});

	it('shows the choice only where group mode exists', () => {
		expect(chooserShown('all')).toBe(true);
		expect(chooserShown(null)).toBe(true);
		expect(chooserShown('own')).toBe(false);
		expect(chooserShown('follow')).toBe(false);
	});
});
