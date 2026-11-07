import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, or, type SQL } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Db } from './db';
import { invites, users } from './db/schema';
import { rejectWeak } from './admin';
import { hashInviteCode } from './invite-code';
import { hashPassword } from './password';
import { cleanName } from '$lib/names';
import { DEFAULT_STORAGE_LIMIT_BYTES, INVITE_TTL_MS } from '$lib/limits';
import type { DanceSlug } from '$lib/dances/dances';
import { parseLocale, type Locale } from '$lib/i18n/locale';

export type JoinResult =
	| {
			ok: true;
			userId: string;
			/** The new account's language: the invite's; null for an invite made before languages. */
			locale: Locale | null;
	  }
	| {
			ok: false;
			reason: 'invite' | 'email' | 'email-taken' | 'weak' | 'first-name' | 'last-name';
			message: string;
	  };

export const INVITE_REFUSAL = 'This invite no longer works. Ask for a new one.';

/**
 * An invite's dance: its own, or salsa's for one made before the dance split
 * (they were all made from salsa).
 */
function ofDance(dance: DanceSlug): SQL {
	return dance === 'salsa'
		? (or(eq(invites.dance, 'salsa'), isNull(invites.dance)) as SQL)
		: eq(invites.dance, dance);
}

/**
 * A new one-time code into one dance (an account belongs to one dance); every
 * other unused, unexpired invite of that dance is ended. Only the hash is kept.
 * The invite carries the language the account will be made in (on the row,
 * not in the link: a link cannot be edited into another language).
 */
export function createInvite(
	db: Db,
	adminId: string,
	dance: DanceSlug,
	now: number,
	locale: Locale
): { code: string; expiresAt: number } {
	const code = randomBytes(32).toString('base64url');
	const expiresAt = now + INVITE_TTL_MS;
	db.transaction((tx) => {
		tx.update(invites)
			.set({ expiresAt: now })
			.where(and(isNull(invites.usedAt), gt(invites.expiresAt, now), ofDance(dance)))
			.run();
		tx.insert(invites)
			.values({
				id: randomUUID(),
				codeHash: hashInviteCode(code),
				createdBy: adminId,
				createdAt: now,
				expiresAt,
				dance,
				locale
			})
			.run();
	});
	return { code, expiresAt };
}

/** A live invite of this dance; one of the other dance is as dead as a used one. */
export function inviteValid(db: Db, code: string, dance: DanceSlug, now: number): boolean {
	if (!code) return false;
	const row = db
		.select({ id: invites.id })
		.from(invites)
		.where(
			and(
				eq(invites.codeHash, hashInviteCode(code)),
				isNull(invites.usedAt),
				gt(invites.expiresAt, now),
				ofDance(dance)
			)
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
		/** The request's dance: the invite must be of it, and the account is made in it. */
		dance: DanceSlug;
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
	if (!inviteValid(db, input.code, input.dance, now)) return dead;
	// Unique per dance: the same email may hold an account in the other dance.
	if (
		db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.dance, input.dance), eq(users.email, email)))
			.get()
	) {
		return { ok: false, reason: 'email-taken', message: 'That email already has an account.' };
	}

	// Hash before the transaction: it is async, and the transaction must be synchronous.
	const passwordHash = await hashPassword(input.password);
	const id = randomUUID();
	const taken = Symbol('taken');
	let locale: Locale | null = null;
	try {
		const claimed = db.transaction((tx) => {
			const claimedRows = tx
				.update(invites)
				.set({ usedAt: now, usedBy: id })
				.where(
					and(
						eq(invites.codeHash, hashInviteCode(input.code)),
						isNull(invites.usedAt),
						gt(invites.expiresAt, now),
						ofDance(input.dance)
					)
				)
				.returning({ locale: invites.locale })
				.all();
			if (claimedRows.length !== 1) return false;
			locale = parseLocale(claimedRows[0].locale);
			try {
				tx.insert(users)
					.values({
						id,
						email,
						dance: input.dance,
						firstName,
						lastName,
						passwordHash,
						isAdmin: false,
						storageLimitBytes: DEFAULT_STORAGE_LIMIT_BYTES,
						locale,
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
	return { ok: true, userId: id, locale };
}

/** The QR as plain data, row by row; drawn by `InviteQr.svelte`. Server only. */
export function inviteQr(url: string): { size: number; cells: boolean[] } {
	const { size, data } = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules;
	return { size, cells: Array.from(data, (v) => !!v) };
}
