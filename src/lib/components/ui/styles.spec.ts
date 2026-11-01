import { describe, expect, it } from 'vitest';
import {
	button,
	CHIP,
	DASHED_ADD,
	FIELD,
	FIELD_ERROR,
	FIELD_INVALID,
	SELECT_INVALID,
	TEXTAREA,
	CLIP,
	GROUP,
	iconButton,
	LABEL,
	ROW,
	SECTION_LABEL,
	SELECT,
	SWITCH_TRACK,
	swap
} from './styles';

describe('button', () => {
	it('primary is solid accent', () => {
		const c = button('primary');
		expect(c).toContain('bg-accent');
		expect(c).toContain('text-on-accent');
	});
	it('danger is solid danger', () => expect(button('danger')).toContain('bg-danger'));
	it('tertiary has no background', () => expect(button('tertiary')).not.toContain('bg-'));
	it('full width', () => expect(button('primary', 'lg', true)).toContain('w-full'));
	it('every builder styles disabled', () => {
		for (const k of ['primary', 'secondary', 'tertiary', 'danger', 'danger-text'] as const)
			expect(button(k)).toContain('disabled:');
		for (const v of ['bare', 'tonal', 'filled', 'step'] as const)
			expect(iconButton(v)).toContain('disabled:');
	});
});

describe('constants', () => {
	it('CHIP checks to accent', () => expect(CHIP).toContain('has-checked:before:bg-accent'));
	it('TEXTAREA has no fixed height', () => {
		expect(TEXTAREA.split(' ')).not.toContain('h-[52px]');
		expect(TEXTAREA).toContain('min-h-[52px]');
	});
	it('SELECT is a field-shaped button', () => {
		for (const c of FIELD.split(' ')) expect(SELECT.split(' ')).toContain(c);
		expect(SELECT).toContain('text-left');
		expect(SELECT).toContain('cursor-pointer');
	});
	it('exist', () => {
		for (const s of [FIELD, FIELD_ERROR, LABEL, GROUP, ROW, SECTION_LABEL])
			expect(s.length).toBeGreaterThan(0);
		expect(GROUP).toContain('divide-hairline');
		expect(GROUP.split(' ')).toEqual(expect.arrayContaining(['focus-inset', 'overflow-hidden']));
		expect(CLIP).toBe('focus-inset overflow-hidden');
	});
});

describe('DASHED_ADD', () => {
	it('is a dashed 52 px add control in the accent text colour', () => {
		expect(DASHED_ADD).toContain('border-dashed');
		expect(DASHED_ADD).toContain('text-accent-text');
		expect(DASHED_ADD).toContain('h-[52px]');
		expect(DASHED_ADD).not.toMatch(/text-accent(\s|$)/);
	});
});

describe('SWITCH_TRACK', () => {
	it('is muted when off, accent when on, never the field line', () => {
		expect(SWITCH_TRACK).toContain('bg-muted');
		expect(SWITCH_TRACK).toContain('peer-checked:bg-accent');
		expect(SWITCH_TRACK).not.toContain('bg-field-line');
	});
});

const colours = (c: string) =>
	c.split(' ').filter((x) => /^text-(ink|muted|accent|accent-text|danger|done|on-accent)$/.test(x));

describe('colours come from the builders', () => {
	it('one colour per icon button', () => {
		for (const t of ['ink', 'muted', 'accent', 'accent-text', 'danger', 'done'] as const) {
			expect(colours(iconButton('bare', t))).toEqual([`text-${t}`]);
			expect(colours(iconButton('step', t))).toEqual([`text-${t}`]);
		}
		expect(colours(iconButton('bare'))).toEqual(['text-ink']);
	});
	it('an invalid field keeps a 1 px border', () => {
		expect(FIELD).not.toMatch(/border-2/);
		for (const c of [FIELD_INVALID, SELECT_INVALID]) {
			expect(c.split(' ')).toContain('border-danger');
			expect(c.split(' ')).not.toContain('border-field-line');
			expect(c).not.toMatch(/border-2/);
		}
		expect(SELECT_INVALID.split(' ')).toContain('text-left');
	});
});

describe('swap', () => {
	it('replaces the first occurrence', () => {
		expect(swap('a b c', 'b', 'x y')).toBe('a x y c');
	});
	it('matches whole class tokens, not substrings', () => {
		expect(() => swap('px-3.5 py-1', 'px-3', 'px-4')).toThrow(/px-3/);
		expect(swap('px-3.5 px-3', 'px-3', 'px-4')).toBe('px-3.5 px-4');
		expect(swap('w-[1.5] h-1', 'w-[1.5]', 'w-2')).toBe('w-2 h-1');
	});
	it('throws in dev and tests when the token is missing', () => {
		expect(() => swap(button('primary'), 'text-nope', 'text-ink')).toThrow(/text-nope/);
	});
	it('every swap over a builder still finds its token', () => {
		expect(swap(iconButton('filled'), 'h-11 w-11', 'h-[52px] w-[52px]')).toContain('h-[52px]');
	});
});
