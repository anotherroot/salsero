import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
	password: string | Buffer,
	salt: string | Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * scrypt rather than argon2id.
 *
 * argon2 is the better primitive, but every JS binding for it is a native
 * module, and shipping native bindings to a NixOS host is a category of
 * fragility this project does not need. scrypt is in node core, has no build
 * step, and at these parameters is entirely adequate for a login form that is
 * also rate-limited.
 */
const PARAMS = { N: 1 << 15, r: 8, p: 1 };
const KEYLEN = 64;
// 128 · N · r = 33.5 MB at N=2^15, which is just over node's 32 MB default.
const MAXMEM = 96 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scrypt(password, salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM });
	return [
		'scrypt',
		PARAMS.N,
		PARAMS.r,
		PARAMS.p,
		salt.toString('base64'),
		key.toString('base64')
	].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const [, n, r, p, saltB64, keyB64] = parts;
	const salt = Buffer.from(saltB64, 'base64');
	const expected = Buffer.from(keyB64, 'base64');
	let actual: Buffer;
	try {
		actual = await scrypt(password, salt, expected.length, {
			N: Number(n),
			r: Number(r),
			p: Number(p),
			maxmem: MAXMEM
		});
	} catch {
		return false;
	}
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}
