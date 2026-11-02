import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Db } from './db';
import { invites, users } from './db/schema';
import { rejectWeak } from './admin';
import { hashPassword } from './password';
import { cleanName } from '$lib/names';
import { DEFAULT_STORAGE_LIMIT_BYTES, INVITE_TTL_MS } from '$lib/limits';

export type JoinResult =
	| { ok: true; userId: string }
	| {
			ok: false;
			reason: 'invite' | 'email' | 'email-taken' | 'weak' | 'first-name' | 'last-name';
			message: string;
	  };

export const INVITE_REFUSAL = 'This invite no longer works. Ask for a new one.';

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

/** A new one-time code; every other unused, unexpired invite is ended. Only the hash is kept. */
export function createInvite(
	db: Db,
	adminId: string,
	now: number
): { code: string; expiresAt: number } {
	const code = randomBytes(32).toString('base64url');
	const expiresAt = now + INVITE_TTL_MS;
	db.transaction((tx) => {
		tx.update(invites)
			.set({ expiresAt: now })
			.where(and(isNull(invites.usedAt), gt(invites.expiresAt, now)))
			.run();
		tx.insert(invites)
			.values({
				id: randomUUID(),
				codeHash: hashCode(code),
				createdBy: adminId,
				createdAt: now,
				expiresAt
			})
			.run();
	});
	return { code, expiresAt };
}

export function inviteValid(db: Db, code: string, now: number): boolean {
	if (!code) return false;
	const row = db
		.select({ id: invites.id })
		.from(invites)
		.where(
			and(eq(invites.codeHash, hashCode(code)), isNull(invites.usedAt), gt(invites.expiresAt, now))
		)
		.get();
	return !!row;
}

function validZone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat('en', { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function redeemInvite(
	db: Db,
	input: {
		code: string;
		email: string;
		password: string;
		timezone: string;
		firstName: string;
		lastName: string;
	},
	now: number
): Promise<JoinResult> {
	const email = input.email.trim().toLowerCase();
	if (!EMAIL.test(email)) {
		return { ok: false, reason: 'email', message: 'Enter a valid email address.' };
	}
	const firstName = cleanName(input.firstName);
	if (!firstName) {
		return {
			ok: false,
			reason: 'first-name',
			message: 'Enter your first name (up to 60 letters).'
		};
	}
	const lastName = cleanName(input.lastName);
	if (!lastName) {
		return { ok: false, reason: 'last-name', message: 'Enter your last name (up to 60 letters).' };
	}
	const weak = rejectWeak(input.password);
	if (weak) return { ok: false, reason: 'weak', message: `Password ${weak}.` };
	const dead: JoinResult = { ok: false, reason: 'invite', message: INVITE_REFUSAL };
	if (!inviteValid(db, input.code, now)) return dead;
	if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) {
		return { ok: false, reason: 'email-taken', message: 'That email already has an account.' };
	}

	// Hash before the transaction: it is async, and the transaction must be synchronous.
	const passwordHash = await hashPassword(input.password);
	const id = randomUUID();
	const taken = Symbol('taken');
	try {
		const claimed = db.transaction((tx) => {
			const res = tx
				.update(invites)
				.set({ usedAt: now, usedBy: id })
				.where(
					and(
						eq(invites.codeHash, hashCode(input.code)),
						isNull(invites.usedAt),
						gt(invites.expiresAt, now)
					)
				)
				.run();
			if (res.changes !== 1) return false;
			try {
				tx.insert(users)
					.values({
						id,
						email,
						firstName,
						lastName,
						passwordHash,
						isAdmin: false,
						storageLimitBytes: DEFAULT_STORAGE_LIMIT_BYTES,
						...(validZone(input.timezone) ? { timezone: input.timezone } : {})
					})
					.run();
			} catch {
				throw taken; // rolls the invite back too
			}
			return true;
		});
		if (!claimed) return dead;
	} catch (e) {
		if (e === taken) {
			return { ok: false, reason: 'email-taken', message: 'That email already has an account.' };
		}
		throw e;
	}
	return { ok: true, userId: id };
}

/** The QR as plain data, row by row; drawn by `InviteQr.svelte`. Server only. */
export function inviteQr(url: string): { size: number; cells: boolean[] } {
	const { size, data } = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules;
	return { size, cells: Array.from(data, (v) => !!v) };
}
