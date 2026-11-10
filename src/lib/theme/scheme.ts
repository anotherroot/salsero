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
 *
 * With no cookie the attribute stays empty and the script reads the cookie
 * itself: the shell the service worker serves for a page drawn from the
 * device is cached signed out, with no cookie. So the cookie is readable by
 * scripts (not `httpOnly`); it holds only a colour preference.
 */
import { t } from '$lib/i18n/catalog';

export const THEME_COOKIE = 'theme';

/** How the theme cookie is set: a year, the whole site, readable by app.html's script. */
export const THEME_COOKIE_OPTIONS = {
	path: '/',
	maxAge: 365 * 24 * 3600,
	sameSite: 'lax',
	httpOnly: false
} as const;

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** A choice's name in the current language: System, Light, Dark. */
export function themeLabel(choice: ThemeChoice): string {
	return t().settings.theme[choice];
}

export function isThemeChoice(raw: unknown): raw is ThemeChoice {
	return typeof raw === 'string' && (THEME_CHOICES as readonly string[]).includes(raw);
}

/** The cookie's value as a choice: anything unknown, or none, is System. */
export function themeChoice(raw: string | null | undefined): ThemeChoice {
	return isThemeChoice(raw) ? raw : 'system';
}

/** The placeholder in `src/app.html` the hook fills with the choice. */
export const THEME_PLACEHOLDER = '%salsa.theme%';

/**
 * The page with the placeholder filled in from the cookie's raw value. No
 * valid cookie leaves it empty, and app.html's script asks the cookie again.
 */
export function fillTheme(html: string, raw: string | null | undefined): string {
	return html.replace(THEME_PLACEHOLDER, isThemeChoice(raw) ? raw : '');
}

/** Shows a new choice at once, without a reload: the app.html script re-resolves it. */
export function showChoice(choice: ThemeChoice): void {
	document.documentElement.dataset.themeChoice = choice;
	(window as { salsaTheme?: () => void }).salsaTheme?.();
}
