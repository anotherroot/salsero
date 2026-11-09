import { createHash, randomBytes } from 'node:crypto';

/**
 * A bearer secret: 256 random bits, prefixed so a leaked one is recognisable
 * in a log or a paste. Stored ONLY as `hashSecret(secret)`: 256 bits of
 * entropy needs no salt, and a database leak must not hand out working tokens.
 */
export function newSecret(prefix: 'sa_code_' | 'sa_at_' | 'sa_rt_'): string {
	return prefix + randomBytes(32).toString('base64url');
}

/** SHA-256 hex, as device tokens are kept (`devices.ts`). */
export function hashSecret(secret: string): string {
	return createHash('sha256').update(secret).digest('hex');
}
