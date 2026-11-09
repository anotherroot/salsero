import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { oauthGrants, oauthTokens, users } from '../db/schema';
import {
	ACCESS_TTL_S,
	REFRESH_TTL_S,
	approve,
	exchangeCode,
	listGrants,
	refresh,
	restoreGrant,
	revokeGrant,
	verifyAccessToken,
	type OAuthFail,
	type TokenPair
} from './store';

const now = 1_800_000_000_000;
const sec = (n: number) => now + n * 1000;

const VERIFIER = 'a'.repeat(50);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const CLIENT = 'https://claude.ai/oauth/client.json';

let db: Db;
const me = 'u1';
beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x', dance: 'salsa' })
			.run();
});

const approveFor = (userId = me, clientId = CLIENT, t = now) =>
	approve(
		db,
		{ userId, clientId, clientName: 'Claude', redirectUri: REDIRECT, codeChallenge: CHALLENGE },
		t
	);
const exchange = (code: string, t = now, over: Partial<Parameters<typeof exchangeCode>[1]> = {}) =>
	exchangeCode(
		db,
		{ code, verifier: VERIFIER, redirectUri: REDIRECT, clientId: CLIENT, ...over },
		t
	);
const pair = (t = now): TokenPair => {
	const r = exchange(approveFor(me, CLIENT, t), t);
	if ('error' in r) throw new Error(r.description);
	return r;
};
const failed = (r: TokenPair | OAuthFail) => ('error' in r ? r.error : null);

describe('codes', () => {
	it('a code exchanges once for a token pair', () => {
		const code = approveFor();
		expect(code.startsWith('sa_code_')).toBe(true);
		const r = exchange(code);
		expect(r).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'salsa' });
		if ('error' in r) throw new Error('unreachable');
		expect(ACCESS_TTL_S).toBe(3600);
		expect(r.access_token.startsWith('sa_at_')).toBe(true);
		expect(r.refresh_token.startsWith('sa_rt_')).toBe(true);
		expect(verifyAccessToken(db, r.access_token, now)).toMatchObject({ userId: me });
	});

	it('a wrong verifier burns the code', () => {
		const code = approveFor();
		expect(failed(exchange(code, now, { verifier: 'b'.repeat(50) }))).toBe('invalid_grant');
		expect(failed(exchange(code))).toBe('invalid_grant');
	});

	it('a code used twice revokes its grant', () => {
		const code = approveFor();
		const first = exchange(code);
		if ('error' in first) throw new Error('unreachable');
		expect(verifyAccessToken(db, first.access_token, now)).not.toBeNull();
		expect(failed(exchange(code))).toBe('invalid_grant');
		expect(verifyAccessToken(db, first.access_token, now)).toBeNull();
	});

	it('an expired code is refused', () => {
		expect(failed(exchange(approveFor(), sec(61)))).toBe('invalid_grant');
	});

	it('a code for another client or redirect is refused', () => {
		expect(failed(exchange(approveFor(), now, { clientId: 'https://claude.ai/other.json' }))).toBe(
			'invalid_grant'
		);
		expect(
			failed(exchange(approveFor(), now, { redirectUri: 'https://claude.ai/elsewhere' }))
		).toBe('invalid_grant');
	});

	it('an unknown code is refused', () => {
		expect(failed(exchange('sa_code_nope'))).toBe('invalid_grant');
	});

	it('approving the same client again revokes the earlier grant', () => {
		const first = pair();
		const second = pair();
		expect(verifyAccessToken(db, first.access_token, now)).toBeNull();
		expect(verifyAccessToken(db, second.access_token, now)).not.toBeNull();
		expect(listGrants(db, me, now)).toHaveLength(1);
	});

	it('a code of a grant that was replaced is refused', () => {
		const first = approveFor();
		approveFor();
		expect(failed(exchange(first))).toBe('invalid_grant');
	});

	it('keeps only hashes', () => {
		const p = pair();
		const rows = JSON.stringify(db.select().from(oauthTokens).all());
		expect(rows).not.toContain(p.access_token);
		expect(rows).not.toContain(p.refresh_token);
	});
});

describe('refresh', () => {
	const again = (token: string, t: number, clientId = CLIENT) =>
		refresh(db, { refreshToken: token, clientId }, t);

	it('rotates: the old refresh is refused, the new pair works', () => {
		const p = pair();
		const n = again(p.refresh_token, sec(10));
		if ('error' in n) throw new Error(n.description);
		expect(n.refresh_token).not.toBe(p.refresh_token);
		expect(verifyAccessToken(db, n.access_token, sec(10))).not.toBeNull();
		expect(failed(again(p.refresh_token, sec(11)))).toBe('invalid_grant');
	});

	it('a refresh replayed within 30 s is refused without revoking', () => {
		const p = pair();
		const n = again(p.refresh_token, sec(10));
		if ('error' in n) throw new Error(n.description);
		expect(failed(again(p.refresh_token, sec(30)))).toBe('invalid_grant');
		expect(verifyAccessToken(db, n.access_token, sec(30))).not.toBeNull();
	});

	it('a refresh replayed after 30 s revokes the grant', () => {
		const p = pair();
		const n = again(p.refresh_token, sec(10));
		if ('error' in n) throw new Error(n.description);
		expect(failed(again(p.refresh_token, sec(41)))).toBe('invalid_grant');
		expect(verifyAccessToken(db, n.access_token, sec(41))).toBeNull();
		expect(failed(again(n.refresh_token, sec(42)))).toBe('invalid_grant');
	});

	it('refuses another client, an expired token and an unknown one', () => {
		const p = pair();
		expect(failed(again(p.refresh_token, now, 'https://x.eu/c'))).toBe('invalid_grant');
		expect(failed(again(p.refresh_token, sec(REFRESH_TTL_S + 1)))).toBe('invalid_grant');
		expect(failed(again('sa_rt_x', now))).toBe('invalid_grant');
	});

	it('prunes expired access tokens', () => {
		const p = pair();
		again(p.refresh_token, sec(7200));
		const rows = db.select().from(oauthTokens).all();
		expect(rows.some((r) => r.kind === 'access' && r.expiresAt < sec(7200))).toBe(false);
	});
});

describe('verifyAccessToken', () => {
	it('refuses expired, revoked, unknown and non-sa_at_ tokens', () => {
		const p = pair();
		expect(verifyAccessToken(db, p.access_token, now)).toMatchObject({ userId: me });
		expect(verifyAccessToken(db, p.access_token, sec(3601))).toBeNull();
		expect(verifyAccessToken(db, 'sa_at_unknown', now)).toBeNull();
		expect(verifyAccessToken(db, p.refresh_token, now)).toBeNull();
		expect(verifyAccessToken(db, null, now)).toBeNull();
		expect(verifyAccessToken(db, '', now)).toBeNull();
		const [g] = listGrants(db, me, now);
		expect(revokeGrant(db, me, g.id, now)).toBe(true);
		expect(verifyAccessToken(db, p.access_token, now)).toBeNull();
	});

	it('last_used_at is touched at most once a minute', () => {
		const p = pair();
		const used = () =>
			db.select().from(oauthGrants).where(eq(oauthGrants.userId, me)).get()!.lastUsedAt;
		verifyAccessToken(db, p.access_token, sec(1));
		expect(used()).toBe(sec(1));
		verifyAccessToken(db, p.access_token, sec(30));
		expect(used()).toBe(sec(1));
		verifyAccessToken(db, p.access_token, sec(62));
		expect(used()).toBe(sec(62));
	});
});

describe('grants', () => {
	const connect = (clientId: string, t: number) => {
		const r = exchange(approveFor(me, clientId, t), t, { clientId });
		if ('error' in r) throw new Error(r.description);
		return r;
	};

	it('revokeGrant only revokes the caller own grant', () => {
		const p = pair();
		const [g] = listGrants(db, me, now);
		expect(revokeGrant(db, 'u2', g.id, now)).toBe(false);
		expect(listGrants(db, me, now)).toHaveLength(1);
		expect(revokeGrant(db, me, g.id, now)).toBe(true);
		expect(failed(refresh(db, { refreshToken: p.refresh_token, clientId: CLIENT }, sec(1)))).toBe(
			'invalid_grant'
		);
		expect(revokeGrant(db, me, g.id, now)).toBe(false);
		expect(listGrants(db, me, now)).toEqual([]);
	});

	it('restoreGrant undoes a revoke within 60 s, only for its owner', () => {
		const p = pair();
		const [g] = listGrants(db, me, now);
		revokeGrant(db, me, g.id, now);
		expect(restoreGrant(db, 'u2', g.id, sec(5))).toBe(false);
		expect(restoreGrant(db, me, g.id, sec(5))).toBe(true);
		expect(verifyAccessToken(db, p.access_token, sec(5))).not.toBeNull();
		revokeGrant(db, me, g.id, sec(10));
		expect(restoreGrant(db, me, g.id, sec(71))).toBe(false);
		expect(listGrants(db, me, sec(71))).toEqual([]);
	});

	it('lists live grants, newest first, with the host to show', () => {
		connect('https://a.eu/c', now);
		connect('https://b.eu/c', sec(5));
		const list = listGrants(db, me, sec(6));
		expect(list.map((g) => g.clientId)).toEqual(['https://b.eu/c', 'https://a.eu/c']);
		expect(list[0]).toMatchObject({
			clientName: 'Claude',
			host: 'b.eu',
			lastUsedAt: null,
			createdAt: sec(5)
		});
	});

	it('an approved grant with no token exchanged is not listed', () => {
		approveFor(me, 'https://a.eu/c', now);
		expect(listGrants(db, me, sec(1))).toEqual([]);
	});

	it('a grant whose refresh tokens all expired or were spent is not listed', () => {
		const p = connect('https://a.eu/c', now);
		expect(listGrants(db, me, sec(REFRESH_TTL_S - 1))).toHaveLength(1);
		expect(listGrants(db, me, sec(REFRESH_TTL_S + 1))).toEqual([]);
		const r = refresh(db, { refreshToken: p.refresh_token, clientId: 'https://a.eu/c' }, sec(10));
		expect('error' in r).toBe(false);
		expect(listGrants(db, me, sec(11))).toHaveLength(1);
	});
});
