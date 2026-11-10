import { describe, expect, it } from 'vitest';
import type { CopyHereView } from '$lib/types';
import { copyHereLines } from './copy-here';

const MB = 1024 ** 2;
const view = (over: Partial<CopyHereView> = {}): CopyHereView => ({
	goes: '1 recording (5 MB, charged to the group) · notes',
	bytes: 5 * MB,
	already: [],
	twins: [],
	staysBehind: 3,
	usedBytes: 100 * MB,
	limitBytes: 1024 * MB,
	...over
});
const base = {
	kind: 'figure' as const,
	label: 'Cradle entry · Basic',
	from: null,
	into: 'Intenziuci poletje 2026'
};

describe('copyHereLines', () => {
	it('asks to copy into the group, and says it comes in as a clone of yours', () => {
		const l = copyHereLines(view(), base);
		expect(l.title).toBe('Copy Cradle entry · Basic into Intenziuci poletje 2026?');
		expect(l.lead).toContain('clone of yours');
		expect(copyHereLines(view(), { ...base, from: 'Sreda 17:30' }).lead).toContain(
			'the one in Sreda 17:30'
		);
		expect(l.goes).toBe('1 recording (5 MB, charged to the group) · notes');
	});

	it('says what stays behind: sections for a figure or drill, sections and points for a position, nothing for a routine', () => {
		expect(copyHereLines(view(), base).behind).toBe('3 sections from lesson videos');
		expect(copyHereLines(view({ staysBehind: 1 }), { ...base, kind: 'drill' }).behind).toBe(
			'1 section from a lesson video'
		);
		expect(copyHereLines(view({ staysBehind: 2 }), { ...base, kind: 'position' }).behind).toBe(
			'2 sections or points from lesson videos'
		);
		expect(copyHereLines(view(), { ...base, kind: 'routine' }).behind).toBeNull();
		expect(copyHereLines(view({ staysBehind: 0 }), base).behind).toBeNull();
	});

	it('says when the copy would not fit the group’s space', () => {
		expect(copyHereLines(view(), base).room).toBeNull();
		const full = copyHereLines(view({ usedBytes: 1022 * MB }), base);
		expect(full.room).toMatch(/^Not enough room: the group uses/);
	});

	it('warns when the group has its own of that name', () => {
		expect(copyHereLines(view(), base).sameName).toBeNull();
		expect(copyHereLines(view(), { ...base, sameName: true }).sameName).toBe(
			'Intenziuci poletje 2026 has its own Cradle entry · Basic, not a copy of yours.'
		);
	});
});
