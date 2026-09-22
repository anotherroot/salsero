import { json } from '@sveltejs/kit';

/**
 * Liveness probe. Public by design — scripts/deploy.sh curls it from INSIDE
 * the box over loopback after a restart, so it must not require a session.
 */
export const GET = () => json({ ok: true });
