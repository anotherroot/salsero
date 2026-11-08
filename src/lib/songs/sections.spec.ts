import { describe, expect, it } from 'vitest';
import { parseSections, sectionsJson } from './sections';

describe('parseSections', () => {
	it('reads bad JSON as no sections and drops bad entries', () => {
		for (const bad of [null, undefined, '', 'null', '{}', '{x', '[1]']) {
			expect(parseSections(bad)).toEqual([]);
		}
		expect(
			parseSections(
				'[{"at":"x","name":"A","countOff":false},{"at":4,"name":"B","countOff":false},{"at":-1,"name":"C","countOff":false},{"at":2,"name":3,"countOff":false},{"at":3,"name":"D","countOff":"yes"}]'
			)
		).toEqual([{ at: 4, name: 'B', countOff: false }]);
		expect(
			parseSections(JSON.stringify([{ at: 1, name: 'x'.repeat(300), countOff: true }]))[0].name
		).toHaveLength(40);
	});

	it('sorts by time and trims names', () => {
		expect(
			parseSections(
				JSON.stringify([
					{ at: 9, name: ' Mambo ', countOff: false },
					{ at: 1, name: 'Intro', countOff: true }
				])
			)
		).toEqual([
			{ at: 1, name: 'Intro', countOff: true },
			{ at: 9, name: 'Mambo', countOff: false }
		]);
	});

	it('writes the canonical JSON it reads back', () => {
		const list = [
			{ at: 9, name: 'Mambo', countOff: false },
			{ at: 1, name: '', countOff: true }
		];
		const json = sectionsJson(list);
		expect(json).toBe(
			'[{"at":1,"name":"","countOff":true},{"at":9,"name":"Mambo","countOff":false}]'
		);
		expect(parseSections(json)).toEqual(parseSections(JSON.stringify(list)));
	});
});
