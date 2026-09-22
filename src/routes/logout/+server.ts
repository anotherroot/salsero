import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, destroySession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	destroySession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	throw redirect(303, '/login');
};
