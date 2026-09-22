import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Check the home worker's bearer token. Hashing both sides first gives
 * timingSafeEqual equal-length inputs, so the comparison leaks neither the
 * token nor its length. No configured token means no worker access at all.
 */
export function workerTokenOk(header: string | null, expected: string | undefined): boolean {
	if (!expected || !header?.startsWith('Bearer ')) return false;
	const digest = (s: string) => createHash('sha256').update(s).digest();
	return timingSafeEqual(digest(header.slice(7)), digest(expected));
}
