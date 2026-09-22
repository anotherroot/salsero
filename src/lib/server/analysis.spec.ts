import { describe, expect, it } from 'vitest';
import { parseAnalysis } from './analysis';

describe('parseAnalysis', () => {
	it('accepts ascending finite times', () => {
		expect(parseAnalysis({ beats: [0.5, 1], downbeats: [0.5], durationS: 3 })).toEqual({
			beats: [0.5, 1],
			downbeats: [0.5],
			durationS: 3
		});
	});
	it('rejects the wrong shape with a message', () => {
		expect(parseAnalysis(null)).toMatch(/object/);
		expect(parseAnalysis({ beats: 'x', downbeats: [], durationS: 1 })).toMatch(/beats/);
		expect(parseAnalysis({ beats: [1, Number.NaN], downbeats: [], durationS: 1 })).toMatch(/beats/);
		expect(parseAnalysis({ beats: [2, 1], downbeats: [], durationS: 3 })).toMatch(/ascending/);
		expect(parseAnalysis({ beats: [1, 2], downbeats: [], durationS: -1 })).toMatch(/durationS/);
		expect(parseAnalysis({ beats: [], downbeats: [], durationS: 1 })).toMatch(/no beats/);
		expect(
			parseAnalysis({
				beats: Array.from({ length: 20_001 }, (_, i) => i),
				downbeats: [],
				durationS: 1
			})
		).toMatch(/too many/);
	});
});
