import { describe, expect, it } from 'vitest';
import { inWall, requireAdmin, wallOf, type Wall } from './scope';

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
