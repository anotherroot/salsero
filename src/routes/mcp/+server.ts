import { eq } from 'drizzle-orm';
import { handleMcpHttp } from '$lib/mcp/http';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { danceHosts } from '$lib/server/hosts';
import { hostDance } from '$lib/dances/hosts';
import { isDanceSlug } from '$lib/dances/dances';
import { toolHostFor } from '$lib/server/mcp/host';
import { wwwAuthenticate } from '$lib/server/oauth/metadata';
import { verifyAccessToken } from '$lib/server/oauth/store';
import { serverNow } from '$lib/server/server-clock';
import type { RequestHandler } from './$types';

function bearer(header: string | null): string | null {
	const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
	return m ? m[1] : null;
}

/**
 * The MCP endpoint of the AI connector. BEARER ONLY: the hook gives /mcp no
 * session (`csrf.ts`, SELF_AUTHED_PATHS). A browser-origin request is refused
 * outright (DNS rebinding); AI apps call server-to-server, with no Origin.
 * An account belongs to one dance: on a dance's host, the other dance's token
 * is no way in.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return new Response('Forbidden origin', { status: 403 });

	const db = getDb();
	const now = serverNow();
	const auth = verifyAccessToken(db, bearer(request.headers.get('authorization')), now);
	const user = auth
		? db.select({ dance: users.dance }).from(users).where(eq(users.id, auth.userId)).get()
		: undefined;
	const here = hostDance(danceHosts(), url.host);
	if (!auth || !user?.dance || !isDanceSlug(user.dance) || (here && here !== user.dance)) {
		return Response.json(
			{ error: 'invalid_token', error_description: 'Sign in to use this connector.' },
			{ status: 401, headers: { 'www-authenticate': wwwAuthenticate(url.origin) } }
		);
	}
	return handleMcpHttp(
		request,
		toolHostFor({ db, userId: auth.userId, dance: user.dance, grantId: auth.grantId, now })
	);
};

const notHere: RequestHandler = () =>
	new Response(null, { status: 405, headers: { allow: 'POST' } });
export const GET = notHere;
export const DELETE = notHere;
