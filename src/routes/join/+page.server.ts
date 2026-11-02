import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearLoginAttempts,
	createSession,
	isRateLimited,
	recordFailedLogin
} from '$lib/server/auth';
import { INVITE_REFUSAL, inviteValid, redeemInvite } from '$lib/server/invites';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, parent }) => {
	const code = url.searchParams.get('code') ?? '';
	const { lastDance } = await parent();
	return { valid: inviteValid(getDb(), code, Date.now()), code, dance: lastDance };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const code = String(form.get('code') ?? url.searchParams.get('code') ?? '');
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		const timezone = String(form.get('timezone') ?? '');
		const firstName = String(form.get('firstName') ?? '').trim();
		const lastName = String(form.get('lastName') ?? '').trim();

		if (!email || !password) {
			return fail(400, {
				message: 'Email and password are required.',
				email,
				firstName,
				lastName,
				field: undefined,
				dead: false
			});
		}
		const ip = getClientAddress();
		if (isRateLimited(ip, email)) {
			return fail(429, {
				message: 'Too many attempts. Wait 15 minutes and try again.',
				email,
				firstName,
				lastName,
				field: undefined,
				dead: false
			});
		}

		const result = await redeemInvite(
			getDb(),
			{ code, email, password, timezone, firstName, lastName },
			Date.now()
		);
		if (!result.ok) {
			if (result.reason === 'invite') {
				recordFailedLogin(ip, email);
				return fail(400, {
					message: INVITE_REFUSAL,
					email,
					firstName,
					lastName,
					field: undefined,
					dead: true
				});
			}
			const field: 'firstName' | 'lastName' | undefined =
				result.reason === 'first-name'
					? 'firstName'
					: result.reason === 'last-name'
						? 'lastName'
						: undefined;
			return fail(400, { message: result.message, email, firstName, lastName, field, dead: false });
		}

		clearLoginAttempts(email);
		const session = createSession(result.userId);
		cookies.set(SESSION_COOKIE, session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: session.expiresAt
		});
		throw redirect(303, '/');
	}
};
