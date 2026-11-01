import { describe, expect, it } from 'vitest';
import { RUN_STOP, SETUP_PLAY, SETUP_PLAY_BUSY, SETUP_VOICE_ROW } from './styles';

const tokens = (cls: string) => new Set(cls.split(/\s+/));

// Importing this module ran swap()'s dev guard on each variant; these pin the result.
describe("the Practice screens' variants", () => {
	it('Starting… keeps the accent while disabled', () => {
		expect(tokens(SETUP_PLAY).has('disabled:bg-disabled-bg')).toBe(true);
		expect(tokens(SETUP_PLAY_BUSY).has('disabled:bg-disabled-bg')).toBe(false);
		expect(tokens(SETUP_PLAY_BUSY).has('disabled:text-disabled-ink')).toBe(false);
		expect(tokens(SETUP_PLAY_BUSY).has('bg-accent')).toBe(true);
	});
	it('the Voice row is 58 px', () => {
		expect(tokens(SETUP_VOICE_ROW).has('min-h-[58px]')).toBe(true);
		expect(tokens(SETUP_VOICE_ROW).has('min-h-14')).toBe(false);
	});
	it('Stop is soft danger, not solid', () => {
		const t = tokens(RUN_STOP);
		for (const y of ['bg-danger-soft', 'text-danger', 'pr-6', 'pl-5']) expect(t.has(y)).toBe(true);
		for (const n of ['bg-danger', 'text-on-danger', 'px-7']) expect(t.has(n)).toBe(false);
	});
});
