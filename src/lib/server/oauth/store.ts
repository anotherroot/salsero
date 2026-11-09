/**
 * The OAuth server's state. Every secret is stored as its hash; the plaintext
 * exists only in the one response that hands it out. better-sqlite3 runs one
 * transaction at a time, so a read that decides a write inside the same
 * transaction is the claim (copied from homestash's store, made synchronous).
 */
import { and, desc, eq, exists, gt, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { oauthCodes, oauthGrants, oauthTokens } from '../db/schema';
import type { GrantRow } from '$lib/types';
import { verifyS256 } from './pkce';
import { hashSecret, newSecret } from './secrets';
import { SCOPE } from './metadata';
import { clientHost } from './register';

export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 30 * 86_400;
export const CODE_TTL_MS = 60_000;
/**
 * A spent refresh token presented again within this window is answered
 * `invalid_grant` WITHOUT revoking the grant: two near-simultaneous refreshes
 * are a race, not a theft. Outside the window it is theft (OAuth 2.1 §4.3.1).
 */
export const REUSE_GRACE_MS = 30_000;
/** How long Settings' Undo may bring a disconnected app back. */
export const RESTORE_MS = 60_000;
/** `last_used_at` is a hint for the list: one write a minute (as devices). */
const TOUCH_EVERY_MS = 60_000;

export type TokenPair = {
	access_token: string;
	token_type: 'Bearer';
	expires_in: number;
	refresh_token: string;
	scope: string;
};
export type OAuthFail = {
	error: 'invalid_grant' | 'invalid_request' | 'invalid_client';
	description: string;
};

const fail = (error: OAuthFail['error'], description: string): OAuthFail => ({
	error,
	description
});

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Approve a client for a person: replaces any earlier grant to it, returns a one-time code. */
export function approve(
	db: Db,
	input: {
		userId: string;
		clientId: string;
		clientName: string | null;
		redirectUri: string;
		codeChallenge: string;
	},
	now: number
): string {
	const code = newSecret('sa_code_');
	db.transaction((tx) => {
		tx.update(oauthGrants)
			.set({ revokedAt: now })
			.where(
				and(
					eq(oauthGrants.userId, input.userId),
					eq(oauthGrants.clientId, input.clientId),
					isNull(oauthGrants.revokedAt)
				)
			)
			.run();
		const grant = tx
			.insert(oauthGrants)
			.values({
				userId: input.userId,
				clientId: input.clientId,
				clientName: input.clientName,
				redirectUri: input.redirectUri,
				createdAt: now
			})
			.returning({ id: oauthGrants.id })
			.get();
		tx.insert(oauthCodes)
			.values({
				hash: hashSecret(code),
				grantId: grant.id,
				codeChallenge: input.codeChallenge,
				redirectUri: input.redirectUri,
				expiresAt: now + CODE_TTL_MS
			})
			.run();
	});
	return code;
}

function issue(tx: Tx, grantId: number, now: number): TokenPair {
	const access = newSecret('sa_at_');
	const refreshToken = newSecret('sa_rt_');
	tx.insert(oauthTokens)
		.values([
			{
				hash: hashSecret(access),
				grantId,
				kind: 'access',
				expiresAt: now + ACCESS_TTL_S * 1000
			},
			{
				hash: hashSecret(refreshToken),
				grantId,
				kind: 'refresh',
				expiresAt: now + REFRESH_TTL_S * 1000
			}
		])
		.run();
	return {
		access_token: access,
		token_type: 'Bearer',
		expires_in: ACCESS_TTL_S,
		refresh_token: refreshToken,
		scope: SCOPE
	};
}

function revokeById(tx: Tx, grantId: number, now: number) {
	tx.update(oauthGrants)
		.set({ revokedAt: now })
		.where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)))
		.run();
}

/**
 * The code is CLAIMED before anything else is checked, so a wrong PKCE
 * verifier still burns it: a code cannot be retried against guesses. A code
 * presented a second time revokes the grant it made (OAuth 2.1 §4.1.3).
 */
export function exchangeCode(
	db: Db,
	input: { code: string; verifier: string; redirectUri: string; clientId: string },
	now: number
): TokenPair | OAuthFail {
	const hash = hashSecret(input.code);
	return db.transaction((tx) => {
		const row = tx
			.select({ code: oauthCodes, grant: oauthGrants })
			.from(oauthCodes)
			.innerJoin(oauthGrants, eq(oauthGrants.id, oauthCodes.grantId))
			.where(eq(oauthCodes.hash, hash))
			.get();
		if (!row) return fail('invalid_grant', 'Unknown code.');
		if (row.code.usedAt !== null) {
			revokeById(tx, row.grant.id, now);
			return fail('invalid_grant', 'Code already used.');
		}
		tx.update(oauthCodes).set({ usedAt: now }).where(eq(oauthCodes.hash, hash)).run();

		if (row.code.expiresAt < now) return fail('invalid_grant', 'Code expired.');
		if (row.grant.revokedAt !== null) return fail('invalid_grant', 'Grant revoked.');
		if (row.grant.clientId !== input.clientId)
			return fail('invalid_grant', 'Code was issued to another client.');
		if (row.code.redirectUri !== input.redirectUri)
			return fail('invalid_grant', 'redirect_uri does not match.');
		if (!verifyS256(input.verifier, row.code.codeChallenge))
			return fail('invalid_grant', 'PKCE verification failed.');
		return issue(tx, row.grant.id, now);
	});
}

export function refresh(
	db: Db,
	input: { refreshToken: string; clientId: string },
	now: number
): TokenPair | OAuthFail {
	const hash = hashSecret(input.refreshToken);
	return db.transaction((tx) => {
		const row = tx
			.select({ token: oauthTokens, grant: oauthGrants })
			.from(oauthTokens)
			.innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
			.where(and(eq(oauthTokens.hash, hash), eq(oauthTokens.kind, 'refresh')))
			.get();
		if (!row) return fail('invalid_grant', 'Unknown refresh token.');
		if (row.grant.clientId !== input.clientId)
			return fail('invalid_grant', 'Token was issued to another client.');
		if (row.token.replacedAt !== null) {
			if (now - row.token.replacedAt > REUSE_GRACE_MS) revokeById(tx, row.grant.id, now);
			return fail('invalid_grant', 'Refresh token already used.');
		}
		if (row.token.expiresAt < now || row.grant.revokedAt !== null)
			return fail('invalid_grant', 'Refresh token expired or revoked.');

		tx.update(oauthTokens).set({ replacedAt: now }).where(eq(oauthTokens.hash, hash)).run();
		// Nothing grows without bound. Spent refresh tokens stay until they expire (replay detection).
		tx.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now)).run();
		tx.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now)).run();
		return issue(tx, row.grant.id, now);
	});
}

/** The bearer check `/mcp` runs on every request. */
export function verifyAccessToken(
	db: Db,
	token: string | null,
	now: number
): { grantId: number; userId: string } | null {
	if (!token || !token.startsWith('sa_at_')) return null;
	const row = db
		.select({
			grantId: oauthGrants.id,
			userId: oauthGrants.userId,
			lastUsed: oauthGrants.lastUsedAt
		})
		.from(oauthTokens)
		.innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
		.where(
			and(
				eq(oauthTokens.hash, hashSecret(token)),
				eq(oauthTokens.kind, 'access'),
				gt(oauthTokens.expiresAt, now),
				isNull(oauthGrants.revokedAt)
			)
		)
		.get();
	if (!row) return null;
	if (row.lastUsed === null || now - row.lastUsed >= TOUCH_EVERY_MS) {
		db.update(oauthGrants).set({ lastUsedAt: now }).where(eq(oauthGrants.id, row.grantId)).run();
	}
	return { grantId: row.grantId, userId: row.userId };
}

/** Only the owner's own live grant; answers whether one was revoked. */
export function revokeGrant(db: Db, userId: string, grantId: number, now: number): boolean {
	const r = db
		.update(oauthGrants)
		.set({ revokedAt: now })
		.where(
			and(
				eq(oauthGrants.id, grantId),
				eq(oauthGrants.userId, userId),
				isNull(oauthGrants.revokedAt)
			)
		)
		.run();
	return r.changes > 0;
}

/** Settings' Undo: only the owner's grant, revoked within the last minute. */
export function restoreGrant(db: Db, userId: string, grantId: number, now: number): boolean {
	const r = db
		.update(oauthGrants)
		.set({ revokedAt: null })
		.where(
			and(
				eq(oauthGrants.id, grantId),
				eq(oauthGrants.userId, userId),
				gt(oauthGrants.revokedAt, now - RESTORE_MS)
			)
		)
		.run();
	return r.changes > 0;
}

/**
 * Live grants, newest first: not revoked, and with at least one refresh token
 * that is neither expired nor replaced (a grant approved but never exchanged,
 * or whose refresh tokens have all run out, is no connection any more).
 */
export function listGrants(db: Db, userId: string, now: number): GrantRow[] {
	const live = db
		.select({ one: sql`1` })
		.from(oauthTokens)
		.where(
			and(
				eq(oauthTokens.grantId, oauthGrants.id),
				eq(oauthTokens.kind, 'refresh'),
				gt(oauthTokens.expiresAt, now),
				isNull(oauthTokens.replacedAt)
			)
		);
	return db
		.select()
		.from(oauthGrants)
		.where(and(eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt), exists(live)))
		.orderBy(desc(oauthGrants.createdAt), desc(oauthGrants.id))
		.all()
		.map((g) => ({
			id: g.id,
			clientId: g.clientId,
			clientName: g.clientName,
			host: clientHost(g.clientId, g.redirectUri),
			createdAt: g.createdAt,
			lastUsedAt: g.lastUsedAt
		}));
}
