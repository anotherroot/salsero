import { describe, expect, it } from 'vitest';
import { HIDE, ON_VIDEO, playerButton, roundButton } from './styles';

const KINDS = ['neutral', 'accent', 'ghost', 'glass', 'outline', 'danger-text'] as const;
const SIZES = ['sm', 'md', 'lg', 'xl', 'cta'] as const;
const ROUND = [44, 48, 54, 56, 58, 66, 78] as const;

describe('playerButton', () => {
	it('uses tokens only', () => {
		for (const k of KINDS)
			for (const s of SIZES)
				for (const sh of ['pill', 'tile'] as const) {
					const c = playerButton(k, s, sh);
					expect(c).not.toContain('--pl-');
					expect(c).not.toContain('#');
				}
	});
	it('has the kinds, shapes and disabled look', () => {
		expect(playerButton('accent')).toContain('bg-accent');
		expect(playerButton('accent')).toContain('text-on-accent');
		expect(playerButton('glass')).toContain('bg-surface/72');
		const tile = playerButton('neutral', 'xl', 'tile');
		expect(tile).toContain('rounded-2xl');
		expect(tile).not.toContain('rounded-full');
		expect(playerButton('neutral')).toContain('disabled:bg-disabled-bg');
	});
	it('carries flex-none, so a caller that wants flex-1 swaps it with .replace', () => {
		for (const k of KINDS) expect(playerButton(k)).toContain('flex-none');
		expect(HIDE).toContain('flex-none');
	});
});

describe('roundButton', () => {
	it('uses tokens only and sets no font size', () => {
		for (const k of ['neutral', 'accent', 'glass', 'ghost'] as const)
			for (const s of ROUND) {
				const c = roundButton(k, s);
				expect(c).not.toContain('--pl-');
				expect(c).not.toContain('#');
				expect(c).not.toContain('text-[');
			}
	});
	it('sizes', () => expect(roundButton('accent', 66)).toContain('size-[66px]'));
});

describe('ON_VIDEO', () => {
	it('is a scrim pill that leaves the text colour to the caller', () => {
		expect(ON_VIDEO).toContain('bg-black/60');
		expect(ON_VIDEO).not.toContain('text-white');
	});
});
