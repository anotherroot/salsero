import { fail, redirect } from '@sveltejs/kit';
import { APP_COOKIE, APP_VALUE } from '$lib/app-mode';
import { joinLanding } from '$lib/app-update/get-app';
import { getDb } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearLoginAttempts,
	createSession,
	isRateLimited,
	recordFailedLogin
} from '$lib/server/auth';
import { inviteRefusal, inviteValid, redeemInvite } from '$lib/server/invites';
import { t } from '$lib/i18n/catalog';
import { requestDanceOf } from '$lib/server/hosts';
import { setLocaleCookie } from '$lib/server/locale';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

export const load: PageServerLoad = async ({ url, parent }) => {
	const code = url.searchParams.get('code') ?? '';
	// The host's dance (the dance split): an invite of the other dance is dead here.
	const { appDance: dance } = await parent();
	return { valid: inviteValid(getDb(), code, dance, serverNow()), code, dance };
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
		const dance = requestDanceOf(url, null);

		if (!email || !password) {
			return fail(400, {
				message: t().entry.required,
				email,
				firstName,
				lastName,
				field: undefined,
				dead: false
			});
		}
		const ip = getClientAddress();
		if (isRateLimited(ip, email, dance)) {
			return fail(429, {
				message: t().entry.tooMany,
				email,
				firstName,
				lastName,
				field: undefined,
				dead: false
			});
		}

		const result = await redeemInvite(
			getDb(),
			{ code, email, password, timezone, firstName, lastName, dance },
			serverNow()
		);
		if (!result.ok) {
			if (result.reason === 'invite') {
				recordFailedLogin(ip, email, dance);
				return fail(400, {
					message: inviteRefusal(),
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

		clearLoginAttempts(email, dance);
		const session = createSession(result.userId);
		cookies.set(SESSION_COOKIE, session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: session.expiresAt
		});
		// The login page after signing out stays in the account's language.
		setLocaleCookie(cookies, result.locale ?? 'en');
		throw redirect(303, joinLanding(cookies.get(APP_COOKIE) === APP_VALUE));
	}
};
