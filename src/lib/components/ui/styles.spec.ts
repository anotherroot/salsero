import { describe, expect, it } from 'vitest';
import {
	bandButton,
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
	rowButton,
	SECTION_LABEL,
	SELECT,
	SWITCH_TRACK,
	swap,
	DANGER_SHARED,
	FIELD_ON_CARD,
	PLAY_ROUND,
	ROW_TALL,
	SELECT_ON_CARD,
	STRIP_ACTION,
	PUBLISH_ACTION,
	TEXTAREA_ON_CARD
} from './styles';

/** Whole class tokens, so `px-3` is not found inside `px-3.5`. */
const tokens = (cls: string) => new Set(cls.split(/\s+/));

describe('button', () => {
	it('primary is solid accent', () => {
		const c = button('primary');
		expect(c).toContain('bg-accent');
		expect(c).toContain('text-on-accent');
	});
	it('danger is solid danger', () => expect(button('danger')).toContain('bg-danger'));
	it('done-soft is the soft green of Done today', () => {
		const c = button('done-soft');
		expect(c).toContain('bg-done-soft');
		expect(c).toContain('text-done');
	});
	it('done is the solid green of Done · next in a run', () => {
		const c = tokens(rowButton('done'));
		expect(c.has('bg-done') && c.has('text-on-done') && c.has('flex-1')).toBe(true);
		expect(c.has('flex-none')).toBe(false);
	});
	it('tertiary has no background', () => expect(button('tertiary')).not.toContain('bg-'));
	it('full width', () => expect(button('primary', 'lg', true)).toContain('w-full'));
	it('a row button grows with the others, never flex-none (the pane log bar)', () => {
		for (const k of ['primary', 'secondary'] as const) {
			const t = tokens(rowButton(k));
			expect(t.has('flex-1') && t.has('min-w-0') && t.has('w-full')).toBe(true);
			expect(t.has('flex-none')).toBe(false);
		}
	});
	it('every builder styles disabled', () => {
		for (const k of [
			'primary',
			'secondary',
			'tertiary',
			'danger',
			'danger-text',
			'done-soft',
			'done'
		] as const)
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

describe('swap() variants', () => {
	// Importing this module already ran swap()'s dev guard on each one; these
	// pin what each swap is for.
	it('a field on a card reads as a field', () => {
		for (const c of [FIELD_ON_CARD, TEXTAREA_ON_CARD, SELECT_ON_CARD]) {
			expect(tokens(c).has('bg-field')).toBe(true);
			expect(tokens(c).has('bg-surface')).toBe(false);
		}
	});
	it('the round Play is 52 px', () => {
		expect(tokens(PLAY_ROUND).has('size-[52px]')).toBe(true);
		expect(tokens(PLAY_ROUND).has('h-11')).toBe(false);
	});
	it('the tall row is 64 px', () => {
		expect(tokens(ROW_TALL).has('min-h-16')).toBe(true);
		expect(tokens(ROW_TALL).has('min-h-14')).toBe(false);
	});
	it('a shared danger button keeps its colour with less padding', () => {
		expect(tokens(DANGER_SHARED).has('bg-danger')).toBe(true);
		expect(tokens(DANGER_SHARED).has('px-3')).toBe(true);
		expect(tokens(DANGER_SHARED).has('px-6')).toBe(false);
	});
});

describe('STRIP_ACTION', () => {
	/** The tokens that apply below 1024: everything without the `desk:` variant. */
	const phone = (cls: string) => [...tokens(cls)].filter((c) => !c.startsWith('desk:')).sort();

	it("is the band strip's secondary button on the phone, primary on the soft bar on the desktop", () => {
		expect(phone(STRIP_ACTION)).toEqual([...tokens(button('secondary', 'sm'))].sort());
		for (const c of ['bg-accent-soft', 'text-accent-text', 'desk:bg-accent', 'desk:text-on-accent'])
			expect(tokens(STRIP_ACTION).has(c)).toBe(true);
	});
	it('leaves the secondary button as it is', () => {
		expect(button('secondary', 'sm')).not.toContain('desk:');
		expect(tokens(button('secondary', 'sm')).has('bg-accent-soft')).toBe(true);
		expect(tokens(button('secondary', 'sm')).has('text-accent-text')).toBe(true);
	});
});

describe('PUBLISH_ACTION', () => {
	const phone = (cls: string) => [...tokens(cls)].filter((c) => !c.startsWith('desk:'));
	it('is a cream pill with band-coloured text on the phone, the accent fill on the desktop', () => {
		for (const c of ['bg-band-ink', 'text-on-cream', 'desk:bg-accent', 'desk:text-on-accent'])
			expect(tokens(PUBLISH_ACTION).has(c)).toBe(true);
		expect(phone(PUBLISH_ACTION)).not.toContain('bg-accent-soft');
		expect(phone(PUBLISH_ACTION)).not.toContain('text-accent-text');
	});
});

describe('bandButton', () => {
	/** The tokens that apply below 1024: everything without the `desk:` variant. */
	const phone = (cls: string) => [...tokens(cls)].filter((c) => !c.startsWith('desk:')).sort();

	it('is the same band button on the phone, whatever its tone', () => {
		expect(phone(bandButton('pane'))).toEqual(phone(bandButton('band')));
		expect(phone(bandButton('pane-back'))).toEqual(phone(bandButton('band')));
		expect(tokens(bandButton())).toContain('text-band-ink');
	});

	it('is tonal in a pane on the desktop, its back a bare ink icon', () => {
		expect(tokens(bandButton('pane'))).toContain('desk:bg-accent-soft');
		expect(tokens(bandButton('pane'))).toContain('desk:text-accent-text');
		expect(tokens(bandButton('pane-back'))).toContain('desk:text-ink');
		expect(bandButton('band')).not.toContain('desk:');
	});
});

describe('the pane header classes', () => {
	it('PaneHeading and BandHeader share one set: the desk forms are the plain ones behind desk:', async () => {
		const s = await import('./styles');
		const desk = (c: string) =>
			c
				.split(' ')
				.map((x) => `desk:${x}`)
				.join(' ');
		expect(s.PANE_PAD_DESK).toBe(desk(s.PANE_PAD));
		expect(s.PANE_TITLE_DESK).toBe(desk(s.PANE_TITLE));
	});
});
