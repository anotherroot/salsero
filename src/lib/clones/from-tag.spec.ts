import { describe, expect, it } from 'vitest';
import { fromTags, shownName } from './from-tag';

const row = (id: number, name: string, from: string | null = null) => ({ id, name, from });

describe('fromTags', () => {
	it('tags the copy of two rows that share a name', () => {
		const rows = [row(1, 'Basic'), row(2, 'Basic', 'Sreda 17:30')];
		const tags = fromTags(rows);
		expect(shownName(rows[1], tags)).toBe('Basic · Sreda 17:30');
		expect(shownName(rows[0], tags)).toBe('Basic');
	});
	it('leaves a lone copy alone', () => {
		const rows = [row(1, 'Basic', 'Sreda 17:30'), row(2, 'Doble')];
		expect(fromTags(rows).size).toBe(0);
		expect(shownName(rows[0], fromTags(rows))).toBe('Basic');
	});
	it('folds case, accents and spaces', () => {
		const rows = [row(1, 'Básica '), row(2, 'basica', 'Ana')];
		expect(shownName(rows[1], fromTags(rows))).toBe('basica · Ana');
	});
	it('tags every copy with a place when several share', () => {
		const rows = [row(1, 'Basic', 'A'), row(2, 'Basic', 'B')];
		const tags = fromTags(rows);
		expect([...tags.values()]).toEqual(['· A', '· B']);
	});
});
