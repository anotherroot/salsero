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
 * The first of our languages a browser asks for (`Accept-Language`), by q order, ties
 * in header order; a tag counts by its primary subtag (`sl-SI` is `sl`). Null if none.
 */
export function acceptedLocale(header: string | null | undefined): Locale | null {
	if (!header) return null;
	const tags = header.split(',').map((part, i) => {
		const [tag, ...params] = part.trim().split(';');
		const qp = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
		const q = qp === undefined ? 1 : Number(qp.slice(2));
		return { loc: parseLocale(tag.trim().split('-')[0].toLowerCase()), q, i };
	});
	const ours = tags.filter((x) => x.loc !== null && Number.isFinite(x.q) && x.q > 0);
	ours.sort((a, b) => b.q - a.q || a.i - b.i);
	return ours[0]?.loc ?? null;
}

/**
 * The language a request is drawn in. A signed-in person's own (null is English),
 * never the cookie; signed out, an invite's language, then the cookie's, then the
 * browser's (`Accept-Language`: the Android app's first sign-in has no cookie), then
 * English.
 */
export function requestLocale(i: {
	user: { locale: Locale | null } | null;
	cookie: string | undefined;
	invite: Locale | null;
	acceptLanguage?: string | null;
}): Locale {
	if (i.user) return i.user.locale ?? 'en';
	return i.invite ?? parseLocale(i.cookie) ?? acceptedLocale(i.acceptLanguage) ?? 'en';
}
