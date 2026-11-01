/**
 * Light or dark, as chosen in Settings. PURE apart from `showChoice`, which
 * touches the document. Client-safe.
 *
 * The choice lives in a cookie, per browser: the work PC and the phone each keep
 * their own. The server writes it into `<html data-theme-choice>` (the hook's
 * `transformPageChunk`), and the script in `src/app.html` turns it into
 * `data-theme="light|dark"` before the first paint, asking `prefers-color-scheme`
 * when the choice is System. The dark colours in `src/routes/layout.css` hang
 * off that attribute.
 */

export const THEME_COOKIE = 'theme';

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_LABEL: Record<ThemeChoice, string> = {
	system: 'System',
	light: 'Light',
	dark: 'Dark'
};

export function isThemeChoice(raw: unknown): raw is ThemeChoice {
	return typeof raw === 'string' && (THEME_CHOICES as readonly string[]).includes(raw);
}

/** The cookie's value as a choice: anything unknown, or none, is System. */
export function themeChoice(raw: string | null | undefined): ThemeChoice {
	return isThemeChoice(raw) ? raw : 'system';
}

/** The placeholder in `src/app.html` the hook fills with the choice. */
export const THEME_PLACEHOLDER = '%salsa.theme%';

/** The page with the placeholder filled in. */
export function fillTheme(html: string, choice: ThemeChoice): string {
	return html.replace(THEME_PLACEHOLDER, choice);
}

/** Shows a new choice at once, without a reload: the app.html script re-resolves it. */
export function showChoice(choice: ThemeChoice): void {
	document.documentElement.dataset.themeChoice = choice;
	(window as { salsaTheme?: () => void }).salsaTheme?.();
}
