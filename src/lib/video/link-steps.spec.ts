import { describe, expect, it } from 'vitest';
import { destination, linkHeading, openingSteps, refusalAt, stacked } from './link-steps';

describe('openingSteps', () => {
	it('openingSteps: no links → pick; some → links', () => {
		expect(openingSteps(0)).toEqual(['pick']);
		expect(openingSteps(1)).toEqual(['links']);
		expect(openingSteps(3)).toEqual(['links']);
	});
});

describe('the popup’s view rules', () => {
	it('knows which levels are stacked', () => {
		expect(stacked(['pick'], 'pick')).toBe(false);
		expect(stacked(['links'], 'links')).toBe(false);
		expect(stacked(['links', 'pick'], 'pick')).toBe(true);
		expect(stacked(['pick', 'variation'], 'variation')).toBe(true);
		expect(stacked(['pick', 'variation', 'variation-figure'], 'variation-figure')).toBe(true);
	});
	it('heads the popup with the range, the name and the length', () => {
		expect(linkHeading({ startMs: 42000, endMs: 55000, label: 'Doble entry' })).toEqual({
			range: '0:42–0:55',
			sub: 'Doble entry · 13.0 s'
		});
		expect(linkHeading({ startMs: 42000, endMs: 55000, label: null }).sub).toBe('13.0 s');
	});
	it('says where a created thing is linked', () => {
		const spot = { id: 1, startMs: 42000, endMs: 55000, label: null };
		expect(
			destination({ spot, context: { kind: 'lesson', lessonId: 2, title: 'Tuesday class' } })
		).toBe('Linked to 0:42–0:55 and to Tuesday class');
		expect(
			destination({ spot, context: { kind: 'recording', groupId: 3, figure: 'Enchufla' } })
		).toBe('Linked to 0:42–0:55');
	});
	it('puts a refusal under the field it names, if the step shows it', () => {
		expect(refusalAt('variation', 'name')).toBe('name');
		expect(refusalAt('variation', 'groupId')).toBe('groupId');
		expect(refusalAt('figure', 'figureName')).toBe('figureName');
		expect(refusalAt('figure', 'style')).toBe('style');
		expect(refusalAt('drill', 'everyDays')).toBe('everyDays');
		expect(refusalAt('drill', 'figureName')).toBe('banner');
		expect(refusalAt('figure', undefined)).toBe('banner');
	});
});
