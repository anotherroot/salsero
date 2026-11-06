import { describe, expect, it } from 'vitest';
import type { FieldDiff, SendTarget } from '$lib/types';
import { nameDiffOf, renameOffer, sendsOnlyName, withRename } from './rename';

const field = (key: string, v: string) => ({ key, label: key, value: v, show: v });

/** A target-side diff: `mine` the target's value, `theirs` yours. */
const fd = (key: string, target: string | null, yours: string | null): FieldDiff => ({
	key,
	label: key,
	mine: target === null ? null : field(key, target),
	theirs: yours === null ? null : field(key, yours),
	side: 'theirs',
	removal: false
});

function target(id: number, diffs: FieldDiff[]): SendTarget {
	return {
		target: {
			id,
			place: { kind: 'team', teamId: id, name: `G${id}` },
			archived: false
		} as SendTarget['target'],
		comparison: { diffs, picks: {}, seen: 's', synced: true, canTake: true, canSend: true },
		removals: [],
		both: [],
		bytes: 0
	};
}

describe('rename', () => {
	const named = (id: number, now: string) =>
		target(id, [fd('name', now, 'Basic with hips'), fd('timing', '1|8', '1|16')]);

	it('nameDiffOf finds a name or a title, nothing else', () => {
		expect(nameDiffOf(named(1, 'Basic'))?.key).toBe('name');
		expect(nameDiffOf(target(2, [fd('title', 'Old', 'New')]))?.key).toBe('title');
		expect(nameDiffOf(target(3, [fd('timing', '1', '3')]))).toBeNull();
	});

	it('renameOffer: your name, theirs now, and which copies differ', () => {
		const t3 = target(3, [fd('timing', '1', '3')]);
		expect(renameOffer([named(1, 'Basic'), named(2, 'Basic'), t3])).toEqual({
			name: 'Basic with hips',
			names: ['Basic', 'Basic'],
			ids: [1, 2]
		});
		expect(renameOffer([t3])).toBeNull();
	});

	it('withRename adds the name to the picks only when on and the copy differs', () => {
		expect(withRename({ timing: 'theirs' }, named(1, 'Basic'), true)).toEqual({
			timing: 'theirs',
			name: 'theirs'
		});
		expect(withRename({ timing: 'theirs' }, named(1, 'Basic'), false)).toEqual({
			timing: 'theirs'
		});
		const plain = target(3, [fd('timing', '1', '3')]);
		expect(withRename({}, plain, true)).toEqual({});
	});

	it('sendsOnlyName: a copy whose one difference is its name', () => {
		expect(sendsOnlyName(target(1, [fd('name', 'Basic', 'Basic with hips')]))).toBe(true);
		expect(sendsOnlyName(named(1, 'Basic'))).toBe(false);
		expect(sendsOnlyName(target(2, []))).toBe(false);
	});
});
