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
		// No cookie (the shell, cached signed out): left to the script.
		expect(fillTheme(app, undefined)).toContain('data-theme-choice=""');
		expect(fillTheme(app, 'pink')).toContain('data-theme-choice=""');
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

/*
 * app.html's first script, run as the browser would. The shell the service
 * worker caches is drawn signed out, so it always says System: on a page drawn
 * from it (a reload, an update, a language change) the cookie must decide.
 */
describe('app.html picks the scheme before the first paint', () => {
	const app = readFileSync('src/app.html', 'utf8');
	const script = /<script>([\s\S]*?)<\/script>/.exec(app)?.[1] ?? '';

	function run(choice: string, cookie: string, systemDark: boolean) {
		const root = {
			dataset: { themeChoice: choice, pageEpoch: 'x' } as Record<string, string>,
			style: { setProperty() {} }
		};
		const window = {} as Record<string, unknown>;
		const document = { documentElement: root, cookie };
		const matchMedia = () => ({ matches: systemDark, addEventListener() {} });
		new Function('window', 'document', 'matchMedia', script)(window, document, matchMedia);
		return root.dataset.theme;
	}

	it('the page’s own choice when it carries one', () => {
		expect(run('light', '', true)).toBe('light');
		expect(run('dark', '', false)).toBe('dark');
		expect(run('system', '', true)).toBe('dark');
	});

	it('the cookie when the page had none (the shell)', () => {
		expect(run('', 'lang=sl; theme=light; app=salsa', true)).toBe('light');
		expect(run('', 'theme=dark', false)).toBe('dark');
		expect(run('', 'theme=system', true)).toBe('dark');
		expect(run('', 'xtheme=light', true)).toBe('dark');
		expect(run('', 'theme=pink', true)).toBe('dark');
		expect(run('', '', false)).toBe('light');
		// A choice on the page (Settings shows a new one before its cookie lands) wins.
		expect(run('dark', 'theme=light', false)).toBe('dark');
	});
});
