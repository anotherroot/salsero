import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import type { Locale } from '$lib/i18n/locale';
import { openDb, type Db } from './db';
import { invites, users } from './db/schema';
import { createSession, validateSession } from './auth';
import { inviteLocaleOf, setLocale, setLocaleCookie } from './locale';
import { userForDeviceToken, createDeviceToken } from './devices';

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values({ id: 'u1', email: 'a@example.com', passwordHash: 'x', dance: 'salsa' })
		.run();
});

function addInvite(code: string, locale: string | null, usedAt: number | null = null) {
	db.insert(invites)
		.values({
			id: `i-${code}`,
			codeHash: createHash('sha256').update(code).digest('hex'),
			createdBy: 'u1',
			expiresAt: 1,
			usedAt,
			dance: 'salsa',
			locale
		})
		.run();
}

describe("a person's language", () => {
	// Catches: the column not written, or the session not carrying it.
	it('is written by setLocale and carried on the session', () => {
		const { id } = createSession('u1', db);
		expect(validateSession(id, db)?.locale).toBeNull();
		setLocale(db, 'u1', 'sl');
		expect(validateSession(id, db)?.locale).toBe('sl');
		setLocale(db, 'u1', 'en');
		expect(validateSession(id, db)?.locale).toBe('en');
	});

	// Catches: the paired app signing in without the person's language.
	it('is carried on a device token too', () => {
		setLocale(db, 'u1', 'sl');
		const { token } = createDeviceToken(db, 'u1', 'Phone', 0);
		expect(userForDeviceToken(db, token, 0)?.locale).toBe('sl');
	});

	// Catches: anything but a known language reaching the column.
	it('refuses an unknown language', () => {
		expect(() => setLocale(db, 'u1', 'xx' as Locale)).toThrow();
		const { id } = createSession('u1', db);
		expect(validateSession(id, db)?.locale).toBeNull();
	});

	// Catches: a value written by hand reading as a language it is not.
	it('reads an unknown stored value as none', () => {
		db.update(users).set({ locale: 'de' }).run();
		const { id } = createSession('u1', db);
		expect(validateSession(id, db)?.locale).toBeNull();
	});
});

describe("an invite's language", () => {
	it('is found by its code, used or not, and null for an unknown code', () => {
		addInvite('code-sl', 'sl');
		addInvite('code-used', 'sl', 5);
		addInvite('code-none', null);
		expect(inviteLocaleOf(db, 'code-sl')).toBe('sl');
		expect(inviteLocaleOf(db, 'code-used')).toBe('sl');
		expect(inviteLocaleOf(db, 'code-none')).toBeNull();
		expect(inviteLocaleOf(db, 'nope')).toBeNull();
		expect(inviteLocaleOf(db, '')).toBeNull();
	});

	it('reads an unknown stored value as none', () => {
		addInvite('code-de', 'de');
		expect(inviteLocaleOf(db, 'code-de')).toBeNull();
	});
});

describe('the language cookie', () => {
	it('is set for the whole site, for a year, lax and http-only', () => {
		const set = vi.fn();
		setLocaleCookie({ set } as unknown as Cookies, 'sl');
		expect(set).toHaveBeenCalledWith('lang', 'sl', {
			path: '/',
			maxAge: 365 * 24 * 3600,
			sameSite: 'lax',
			httpOnly: true
		});
	});
});
