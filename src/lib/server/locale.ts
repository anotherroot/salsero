// The language on the account, on an invite, and in the browser's cookie.
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { LOCALE_COOKIE, parseLocale, type Locale } from '$lib/i18n/locale';
import type { Db } from './db';
import { invites, users } from './db/schema';
import { hashInviteCode } from './invite-code';

/** A person's language. Anything but a known one throws: the column has no CHECK. */
export function setLocale(db: Db, userId: string, l: Locale): void {
	const checked = parseLocale(l);
	if (!checked) throw new Error(`Unknown language: ${String(l)}`);
	db.update(users).set({ locale: checked }).where(eq(users.id, userId)).run();
}

/** A person's language as stored; null (English) for none or a value that is no language. */
export function localeOf(db: Db, userId: string): Locale | null {
	const row = db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).get();
	return parseLocale(row?.locale);
}

/**
 * An invite's language, by its code (as Join is opened with), whether or not
 * the invite still works: a dead invite's page still says so in its language.
 * Null for an unknown code, an invite with none, or a value that is no language.
 */
export function inviteLocaleOf(db: Db, code: string): Locale | null {
	if (!code) return null;
	const row = db
		.select({ locale: invites.locale })
		.from(invites)
		.where(eq(invites.codeHash, hashInviteCode(code)))
		.get();
	return parseLocale(row?.locale);
}

/** Remembers the language on this browser, for the pages drawn before sign-in. */
export function setLocaleCookie(cookies: Cookies, l: Locale): void {
	cookies.set(LOCALE_COOKIE, l, {
		path: '/',
		maxAge: 365 * 24 * 3600,
		sameSite: 'lax',
		httpOnly: true
	});
}

const LANG_PLACEHOLDER = '%salsa.lang%';

/** `<html lang>` in app.html, filled with the request's language. */
export function fillLang(html: string, l: Locale): string {
	return html.replace(LANG_PLACEHOLDER, l);
}
