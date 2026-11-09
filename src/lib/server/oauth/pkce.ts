import { createHash, timingSafeEqual } from 'node:crypto';

const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/;

/** A base64url SHA-256 is always 43 characters without padding. */
export function isChallenge(s: string): boolean {
	return CHALLENGE.test(s);
}

/** RFC 7636 §4.6, S256 only. Constant-time on the comparison that matters. */
export function verifyS256(verifier: string, challenge: string): boolean {
	if (!VERIFIER.test(verifier) || !isChallenge(challenge)) return false;
	const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
	const expected = Buffer.from(challenge);
	return computed.length === expected.length && timingSafeEqual(computed, expected);
}
