import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { invites, users } from './db/schema';
import { createInvite, inviteQr, inviteValid, redeemInvite } from './invites';
import { DEFAULT_STORAGE_LIMIT_BYTES, INVITE_TTL_MS } from '$lib/limits';

const T0 = 1_760_000_000_000;
const PW = 'Correct-Horse-9';
let db: Db;

const join = (
	code: string,
	over: Partial<{
		email: string;
		password: string;
		timezone: string;
		firstName: string;
		lastName: string;
		dance: 'salsa' | 'bachata';
	}> = {}
) =>
	redeemInvite(
		db,
		{
			code,
			email: 'new@example.com',
			password: PW,
			timezone: 'Europe/Berlin',
			firstName: 'Ana',
			lastName: 'Kranjc',
			dance: 'salsa' as const,
			...over
		},
		T0
	);

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values({
			id: 'admin',
			email: 'a@example.com',
			passwordHash: 'x',
			isAdmin: true,
			dance: 'salsa'
		})
		.run();
});

describe('invites', () => {
	it('redeems once and makes an ordinary account', async () => {
		const { code, expiresAt } = createInvite(db, 'admin', 'salsa', T0);
		expect(expiresAt).toBe(T0 + INVITE_TTL_MS);
		expect(inviteValid(db, code, 'salsa', T0)).toBe(true);
		const r = await join(code);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const u = db.select().from(users).where(eq(users.id, r.userId)).get()!;
		expect(u.isAdmin).toBe(false);
		expect(u.storageLimitBytes).toBe(DEFAULT_STORAGE_LIMIT_BYTES);
		expect(u.timezone).toBe('Europe/Berlin');
		expect(inviteValid(db, code, 'salsa', T0)).toBe(false);
		const again = await join(code, { email: 'other@example.com' });
		expect(again).toMatchObject({ ok: false, reason: 'invite' });
	});

	it('saves the names, and refuses a missing one without using the invite', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		expect(await join(code, { firstName: ' ' })).toMatchObject({ ok: false, reason: 'first-name' });
		expect(await join(code, { lastName: 'x'.repeat(61) })).toMatchObject({
			ok: false,
			reason: 'last-name'
		});
		expect(inviteValid(db, code, 'salsa', T0)).toBe(true);
		const r = await join(code, { firstName: ' Ana ' });
		if (!r.ok) throw new Error('should join');
		const u = db.select().from(users).where(eq(users.id, r.userId)).get()!;
		expect([u.firstName, u.lastName]).toEqual(['Ana', 'Kranjc']);
	});

	it('stores only the hash', () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		const row = db.select().from(invites).get()!;
		expect(row.codeHash).not.toContain(code);
		expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('refuses an expired code', async () => {
		const { code, expiresAt } = createInvite(db, 'admin', 'salsa', T0);
		expect(inviteValid(db, code, 'salsa', expiresAt)).toBe(false);
		const r = await redeemInvite(
			db,
			{
				code,
				email: 'n@example.com',
				password: PW,
				timezone: 'UTC',
				firstName: 'Ana',
				lastName: 'K',
				dance: 'salsa'
			},
			expiresAt
		);
		expect(r).toMatchObject({ ok: false, reason: 'invite' });
	});

	it('refuses an unknown code', async () => {
		expect(await join('nope')).toMatchObject({ ok: false, reason: 'invite' });
	});

	it('a new invite kills the previous unused one', async () => {
		const first = createInvite(db, 'admin', 'salsa', T0);
		const second = createInvite(db, 'admin', 'salsa', T0 + 1000);
		expect(inviteValid(db, first.code, 'salsa', T0 + 1000)).toBe(false);
		expect(inviteValid(db, second.code, 'salsa', T0 + 1000)).toBe(true);
	});

	it('two concurrent redemptions make exactly one account', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		const results = await Promise.all([
			join(code, { email: 'one@example.com' }),
			join(code, { email: 'two@example.com' })
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(results.filter((r) => !r.ok)[0]).toMatchObject({ reason: 'invite' });
		expect(db.select().from(users).all()).toHaveLength(2);
	});

	it('a taken email leaves the invite unused', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		const r = await join(code, { email: 'A@example.com' });
		expect(r).toMatchObject({ ok: false, reason: 'email-taken' });
		expect(inviteValid(db, code, 'salsa', T0)).toBe(true);
		expect(db.select().from(users).all()).toHaveLength(1);
	});

	it('a weak password or bad email leaves the invite unused', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		expect(await join(code, { password: 'short' })).toMatchObject({ ok: false, reason: 'weak' });
		expect(await join(code, { email: 'nope' })).toMatchObject({ ok: false, reason: 'email' });
		expect(inviteValid(db, code, 'salsa', T0)).toBe(true);
	});

	it('a bad timezone falls back to the default', async () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		const r = await join(code, { timezone: 'Mars/Base' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const u = db.select().from(users).where(eq(users.id, r.userId)).get()!;
		expect(u.timezone).toBe('Europe/Ljubljana');
	});

	it('draws a QR as plain data', () => {
		const qr = inviteQr('https://example.com/join?code=abc');
		expect(qr.cells).toHaveLength(qr.size * qr.size);
		expect(qr.size).toBeGreaterThan(20);
	});
});

describe('invites per dance (the dance split)', () => {
	// Catches: a bachata invite opening a salsa account, or Join on the wrong host.
	it('is dead in the other dance and makes an account in its own', async () => {
		const { code } = createInvite(db, 'admin', 'bachata', T0);
		expect(inviteValid(db, code, 'salsa', T0)).toBe(false);
		expect(await join(code)).toMatchObject({ ok: false, reason: 'invite' });
		expect(inviteValid(db, code, 'bachata', T0)).toBe(true);
		const r = await join(code, { dance: 'bachata' });
		if (!r.ok) throw new Error(r.message);
		expect(db.select().from(users).where(eq(users.id, r.userId)).get()?.dance).toBe('bachata');
	});

	// Catches: the old global unique email refusing a second dance's account.
	it('takes an email that has an account only in the other dance', async () => {
		db.insert(users)
			.values({ id: 's', email: 'new@example.com', passwordHash: 'x', dance: 'salsa' })
			.run();
		const { code } = createInvite(db, 'admin', 'bachata', T0);
		expect((await join(code, { dance: 'bachata' })).ok).toBe(true);
		const again = createInvite(db, 'admin', 'salsa', T0);
		expect(await join(again.code)).toMatchObject({ ok: false, reason: 'email-taken' });
	});

	// Catches: making a salsa invite ending the bachata admin's open one.
	it("a new invite ends only its own dance's open one", () => {
		const bachata = createInvite(db, 'admin', 'bachata', T0);
		createInvite(db, 'admin', 'salsa', T0 + 1000);
		expect(inviteValid(db, bachata.code, 'bachata', T0 + 1000)).toBe(true);
	});

	// Catches: an invite made before the split becoming unusable.
	it("an invite from before the split is salsa's", () => {
		const { code } = createInvite(db, 'admin', 'salsa', T0);
		db.update(invites).set({ dance: null }).run();
		expect(inviteValid(db, code, 'salsa', T0)).toBe(true);
		expect(inviteValid(db, code, 'bachata', T0)).toBe(false);
	});
});
