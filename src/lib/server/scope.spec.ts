import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { runInLocale } from './i18n-request';
import {
	inWall,
	requireAdmin,
	requireExerciseInWall,
	requireLessonAccess,
	wallOf,
	type Wall
} from './scope';

const user = (isAdmin = false, dance: 'salsa' | 'bachata' = 'bachata') =>
	({ id: 'u1', email: 'a@x.com', timezone: 'UTC', isAdmin, dance }) as NonNullable<
		App.Locals['user']
	>;
const status = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		return (e as { status?: number }).status;
	}
	return undefined;
};

describe('inWall', () => {
	const wall: Wall = { userId: 'u1', dance: 'salsa' };
	it('is true only when dance and owner both match', () => {
		expect(inWall({ dance: 'salsa', userId: 'u1' }, wall)).toBe(true);
		expect(inWall({ dance: 'bachata', userId: 'u1' }, wall)).toBe(false);
		expect(inWall({ dance: 'salsa', userId: 'u2' }, wall)).toBe(false);
		expect(inWall({ dance: 'salsa', userId: null }, wall)).toBe(false);
	});
});

describe('wallOf', () => {
	it('builds the wall from the slug and the signed-in user', () => {
		expect(wallOf({ dance: 'bachata' }, { user: user() })).toEqual({
			userId: 'u1',
			dance: 'bachata'
		});
	});
	it('404s a bad slug and 401s no user', () => {
		expect(status(() => wallOf({ dance: 'kizomba' }, { user: user() }))).toBe(404);
		expect(status(() => wallOf({ dance: 'salsa' }, { user: null }))).toBe(401);
	});
	// Catches: a salsa account reaching bachata pages, the dance split's whole point.
	it("404s a dance that is not the account's own", () => {
		expect(status(() => wallOf({ dance: 'bachata' }, { user: user(false, 'salsa') }))).toBe(404);
	});
});

describe('requireAdmin', () => {
	it('404s anyone who is not an admin', () => {
		expect(status(() => requireAdmin({ user: user() }))).toBe(404);
		expect(status(() => requireAdmin({ user: null }))).toBe(404);
		expect(status(() => requireAdmin({ user: user(true) }))).toBeUndefined();
	});
});

describe('a refusal in Slovenian', () => {
	const refusal = (fn: () => unknown) => {
		try {
			fn();
		} catch (e) {
			return e as { status?: number; body?: { message?: string } };
		}
		return undefined;
	};

	it("names what is missing, in the reader's language", () => {
		const db = openDb(':memory:');
		const locals = { user: user(false, 'salsa'), appAgent: null, locale: 'en' } as App.Locals;
		const lesson = runInLocale('sl', () =>
			refusal(() => requireLessonAccess(db, locals, { dance: 'salsa' }, 999, 'read'))
		);
		expect(lesson?.status).toBe(404);
		expect(lesson?.body?.message).toBe('Lekcija ne obstaja.');
		const exercise = runInLocale('sl', () =>
			refusal(() => requireExerciseInWall(db, { userId: 'u1', dance: 'salsa' }, 999))
		);
		expect(exercise?.body?.message).toBe('Vaja ne obstaja.');
		const signedOut = runInLocale('sl', () =>
			refusal(() => wallOf({ dance: 'salsa' }, { user: null }))
		);
		expect(signedOut?.body?.message).toBe('Prijavite se');
		// English stays as it was.
		const english = refusal(() => requireLessonAccess(db, locals, { dance: 'salsa' }, 999, 'read'));
		expect(english?.body?.message).toBe('No such lesson');
	});
});
