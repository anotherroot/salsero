import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	SESSION_COOKIE,
	clearLoginAttempts,
	createSession,
	isRateLimited,
	recordFailedLogin,
	verifyPassword
} from '$lib/server/auth';
import { danceInPath, type DanceSlug } from '$lib/dances/dances';
import { safeNext } from '$lib/safe-next';
import { adminFirstName } from '$lib/server/teams';
import { noAccountLine } from '$lib/teams/view';
import type { Actions, PageServerLoad } from './$types';

/**
 * A real scrypt hash of a random string, verified against when the account
 * does not exist. Without it, a missing account returns in microseconds while
 * a real one takes ~100ms, and that timing difference is a free user
 * enumeration oracle.
 */
const DUMMY_HASH =
	'scrypt$32768$8$1$YWJjZGVmZ2hpamtsbW5vcA==$' +
	'ZHVtbXlkdW1teWR1bW15ZHVtbXlkdW1teWR1bW15ZHVtbXlkdW1teWR1bW15ZHVtbXlkdW1teWQ=';

export const load: PageServerLoad = async ({ url, parent }) => {
	const next = safeNext(url.searchParams.get('next'));
	const dance: DanceSlug = danceInPath(next) ?? (await parent()).lastDance;
	// A group link: someone without an account is told who can invite them.
	const noAccount = next.startsWith('/g/') ? noAccountLine(adminFirstName(getDb())) : null;
	return { next, dance, noAccount };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/'));

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required.', email });
		}

		if (isRateLimited(getClientAddress(), email)) {
			return fail(429, {
				message: 'Too many attempts. Wait 15 minutes and try again.',
				email
			});
		}

		const user = getDb().select().from(users).where(eq(users.email, email)).get();

		// Always do the work, even with no account, so both paths cost the same.
		const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

		if (!user || !ok) {
			recordFailedLogin(getClientAddress(), email);
			// Deliberately identical for "no such account" and "wrong password".
			return fail(400, { message: 'Incorrect email or password.', email });
		}

		clearLoginAttempts(email);
		const session = createSession(user.id);
		cookies.set(SESSION_COOKIE, session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: session.expiresAt
		});

		throw redirect(303, next);
	}
};
