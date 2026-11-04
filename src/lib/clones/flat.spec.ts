import { describe, expect, it } from 'vitest';
import { fieldLabel, pieceOf } from './flat';

describe('fieldLabel', () => {
	it('names each root field', () => {
		expect(
			[
				'name',
				'notes',
				'partner',
				'style',
				'timing',
				'positions',
				'practice',
				'title',
				'day',
				'artist',
				'count',
				'sample',
				'slots'
			].map((k) => fieldLabel(k, 'whatever'))
		).toEqual([
			'Name',
			'Notes',
			'Partner',
			'Style',
			'Timing',
			'Positions',
			'Practice',
			'Title',
			'Day',
			'Artist',
			'Count',
			'Sample',
			'Slots'
		]);
	});

	it('names a set member by its prefix', () => {
		expect(fieldLabel('link:https://youtu.be/x?t=1:2', 'youtu.be/x')).toBe('Link · youtu.be/x');
		expect(fieldLabel('fig:g7', 'Enchufla · Doble')).toBe('Figure · Enchufla · Doble');
		expect(fieldLabel('routine:#12', 'Rueda 1')).toBe('Routine · Rueda 1');
		expect(fieldLabel('drill:g3', 'Shines')).toBe('Drill · Shines');
	});

	it('names a piece and its parts', () => {
		expect(fieldLabel('rec:g1', 'Ana, 3 Nov')).toBe('Recording · Ana, 3 Nov');
		expect(fieldLabel('video:#4', 'Week 2')).toBe('Video · Week 2');
		expect(fieldLabel('rec:g1:spot:s2', 'Turn')).toBe('Section · Turn');
		expect(fieldLabel('video:g1:spot:#9', 'Turn')).toBe('Section · Turn');
		expect(fieldLabel('rec:g1:note', 'Ana, 3 Nov')).toBe('Note · Ana, 3 Nov');
		expect(fieldLabel('rec:g1:spot:s2:links', 'Turn')).toBe('Section links · Turn');
	});

	it('refuses a key outside the grammar', () => {
		expect(() => fieldLabel('colour', 'x')).toThrow();
		expect(() => fieldLabel('rec:g1:spot', 'x')).toThrow();
	});
});

describe('pieceOf', () => {
	it('finds the piece a key belongs to', () => {
		expect(pieceOf('rec:g1:spot:s2:links')).toBe('rec:g1');
		expect(pieceOf('rec:g1')).toBe('rec:g1');
		expect(pieceOf('rec:g1:note')).toBe('rec:g1');
		expect(pieceOf('video:#4:spot:s1')).toBe('video:#4');
	});

	it('is null for anything that is not a piece', () => {
		expect(pieceOf('notes')).toBeNull();
		expect(pieceOf('link:https://example.com/rec:g1')).toBeNull();
		expect(pieceOf('fig:g1')).toBeNull();
	});
});
