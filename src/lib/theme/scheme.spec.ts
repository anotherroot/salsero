import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	THEME_CHOICES,
	THEME_PLACEHOLDER,
	fillTheme,
	isThemeChoice,
	themeChoice,
	themeLabel
} from './scheme';

describe('the theme choice', () => {
	it('reads the cookie, System when unknown', () => {
		expect(themeChoice('dark')).toBe('dark');
		expect(themeChoice('light')).toBe('light');
		expect(themeChoice('system')).toBe('system');
		expect(themeChoice(undefined)).toBe('system');
		expect(themeChoice('DARK')).toBe('system');
		expect(isThemeChoice('sepia')).toBe(false);
	});

	it('fills the placeholder app.html carries', () => {
		const app = readFileSync('src/app.html', 'utf8');
		expect(app).toContain(`data-theme-choice="${THEME_PLACEHOLDER}"`);
		expect(fillTheme(app, 'dark')).toContain('data-theme-choice="dark"');
		expect(fillTheme(app, 'dark')).not.toContain(THEME_PLACEHOLDER);
	});
});

describe('themeLabel', () => {
	it('names a choice in the current language', () => {
		expect(THEME_CHOICES.map(themeLabel)).toEqual(['System', 'Light', 'Dark']);
		expect(withLocale('sl', () => THEME_CHOICES.map(themeLabel))).toEqual([
			'Sistemska',
			'Svetla',
			'Temna'
		]);
	});
});
