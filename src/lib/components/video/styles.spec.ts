import { describe, expect, it } from 'vitest';
import {
	EDITOR_DELETE,
	EDITOR_NOW,
	EDITOR_STEP,
	EDITOR_WHOLE,
	HIDE,
	INVITE,
	KEY_CAP,
	MARK_DESK_SQUARE,
	MARK_FILL,
	MARK_GLASS_SQUARE,
	MARK_WIDE,
	ON_VIDEO,
	SECTION_WIDE,
	SHEET_DANGER,
	SHEET_PRIMARY,
	SHEET_SECONDARY,
	SPOT_EDIT,
	SPOT_EDIT_ACCENT,
	TOP_GLASS,
	playerButton,
	roundButton,
	topBack,
	topEdit
} from './styles';

const tokens = (cls: string) => new Set(cls.split(/\s+/));
/** Has every one of `yes` and none of `no`, as whole tokens. */
function swapped(cls: string, yes: string[], no: string[]) {
	const t = tokens(cls);
	for (const y of yes) expect(t.has(y), `${y} in ${cls}`).toBe(true);
	for (const n of no) expect(t.has(n), `${n} in ${cls}`).toBe(false);
}

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

describe("the screens' swap() variants", () => {
	// Importing this module ran swap()'s dev guard on each; these pin the result.
	it('share a row with flex-1 or wider', () => {
		for (const c of [
			EDITOR_STEP,
			EDITOR_WHOLE,
			SHEET_SECONDARY,
			SHEET_PRIMARY,
			SHEET_DANGER,
			MARK_FILL
		])
			swapped(c, ['flex-1'], ['flex-none']);
		swapped(EDITOR_NOW, ['flex-[1.3]', 'flex-col', 'gap-0'], ['flex-1', 'flex-none', 'gap-2']);
		for (const c of [MARK_WIDE, SECTION_WIDE]) swapped(c, ['flex-[1.4]'], ['flex-none']);
	});
	it('trim their padding', () => {
		for (const c of [SPOT_EDIT, SPOT_EDIT_ACCENT]) swapped(c, ['pr-3', 'pl-2.5'], ['px-3']);
		swapped(EDITOR_WHOLE, ['px-1'], ['px-3']);
		swapped(EDITOR_DELETE, ['px-3', 'text-danger'], ['px-4']);
		swapped(SPOT_EDIT_ACCENT, ['bg-accent'], []);
	});
	it('the top bar pills are 40 px in both looks', () => {
		for (const g of [true, false]) swapped(topBack(g), ['h-10', 'pr-3', 'pl-1'], ['h-11', 'px-3']);
		swapped(topBack(true), ['bg-surface/72'], []);
		for (const a of [true, false])
			swapped(topEdit(a), ['h-10', 'pr-3.5', 'pl-3'], ['h-11', 'px-3']);
		swapped(topEdit(true), ['bg-accent'], []);
		swapped(TOP_GLASS, ['h-10', 'bg-surface/72'], ['h-11']);
	});
	it('the square Mark is 44 px with no side padding', () => {
		for (const c of [MARK_DESK_SQUARE, MARK_GLASS_SQUARE]) swapped(c, ['w-11', 'px-0'], ['px-3']);
	});
	it('the Keys cap is a step up from the hint chip', () => {
		swapped(KEY_CAP, ['h-6', 'min-w-6', 'px-1.5', 'text-[12px]'], ['h-5', 'px-1', 'text-[11px]']);
	});
	it('the invite has the darker scrim', () => swapped(INVITE, ['bg-black/75'], ['bg-black/60']));
});
