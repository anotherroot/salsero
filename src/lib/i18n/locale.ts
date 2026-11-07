// The app's languages, and which one a request is drawn in. PURE, client-safe.

export type Locale = 'en' | 'sl';

export const LOCALES: readonly Locale[] = ['en', 'sl'];

/** The cookie that remembers the last language on this browser (pages drawn before sign-in). */
export const LOCALE_COOKIE = 'lang';

/** Each language named in its own words, whatever the page's language: a constant on purpose. */
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', sl: 'Slovenščina' };

export function parseLocale(raw: unknown): Locale | null {
	return typeof raw === 'string' && (LOCALES as readonly string[]).includes(raw)
		? (raw as Locale)
		: null;
}

/**
 * The language a request draws in. A signed-in person's own (null is English),
 * never the cookie; signed out, an invite's language, then the cookie's, then English.
 */
export function requestLocale(i: {
	user: { locale: Locale | null } | null;
	cookie: string | undefined;
	invite: Locale | null;
}): Locale {
	if (i.user) return i.user.locale ?? 'en';
	return i.invite ?? parseLocale(i.cookie) ?? 'en';
}
