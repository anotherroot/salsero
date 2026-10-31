import { describe, expect, it } from 'vitest';
import {
	button,
	CHIP,
	FIELD,
	FIELD_ERROR,
	TEXTAREA,
	GROUP,
	iconButton,
	LABEL,
	ROW,
	SECTION_LABEL,
	SELECT
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
	});
});
