import { describe, expect, it } from 'vitest';
import { isChallenge, verifyS256 } from './pkce';

// RFC 7636 appendix B.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('PKCE S256', () => {
	it('accepts the RFC 7636 test vector', () => expect(verifyS256(VERIFIER, CHALLENGE)).toBe(true));
	it('refuses a different verifier', () =>
		expect(verifyS256(VERIFIER.replace('d', 'e'), CHALLENGE)).toBe(false));
	it('refuses a verifier outside 43–128 unreserved characters', () => {
		expect(verifyS256('short', CHALLENGE)).toBe(false);
		expect(verifyS256(VERIFIER + '!', CHALLENGE)).toBe(false);
	});
	it('knows a challenge when it sees one', () => {
		expect(isChallenge(CHALLENGE)).toBe(true);
		expect(isChallenge('plain-text')).toBe(false);
	});
});
