import { describe, expect, it } from 'vitest';
import { leaveRound, takeRound } from './handoff';
import type { HearingRound } from './drill';

function memory(): Storage {
	const m = new Map<string, string>();
	return {
		get length() {
			return m.size;
		},
		clear: () => m.clear(),
		getItem: (k) => m.get(k) ?? null,
		key: (i) => [...m.keys()][i] ?? null,
		removeItem: (k) => void m.delete(k),
		setItem: (k, v) => void m.set(k, v)
	};
}

const round: HearingRound = {
	kind: 'dropped',
	target: 'one',
	drops: 10,
	songIds: [4],
	score: 78,
	timing: 90,
	count: 0,
	restarts: 5,
	listening: 7,
	changed: false
};

describe('the round handed back to the drill page', () => {
	it('is taken once', () => {
		const s = memory();
		leaveRound(s, 12, round);
		expect(takeRound(s, 11)).toBeNull();
		expect(takeRound(s, 12)).toEqual(round);
		expect(takeRound(s, 12)).toBeNull();
	});

	it('a broken one reads as none', () => {
		const s = memory();
		s.setItem('salsa:hearing-round:12', '{"score":"x"}');
		expect(takeRound(s, 12)).toBeNull();
		s.setItem('salsa:hearing-round:12', 'not json');
		expect(takeRound(s, 12)).toBeNull();
	});
});
