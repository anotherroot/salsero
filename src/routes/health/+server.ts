import { json } from '@sveltejs/kit';
import { SITE_BUILT_AT, SITE_VERSION } from '$lib/build-info';

/**
 * Liveness probe. Public by design — scripts/deploy.sh curls it from INSIDE
 * the box over loopback after a restart, so it must not require a session.
 * It says which build answers (`$lib/build-info`): deploy.sh prints it.
 */
export const GET = () => json({ ok: true, version: SITE_VERSION, builtAt: SITE_BUILT_AT });
