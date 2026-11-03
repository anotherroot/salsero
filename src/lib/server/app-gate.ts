import type { AppAgent, Release } from '$lib/app-update/agent';

/**
 * Whether an API request comes from an app too old to keep using (a 426).
 * The update check itself and the home worker are never refused: an old app
 * must be able to ask where the new one is.
 */
export function refusesOldApp(
	path: string,
	agent: AppAgent | null,
	release: Release | null
): boolean {
	if (!agent || !release) return false;
	if (!path.startsWith('/api/')) return false;
	if (path.startsWith('/api/app-update/') || path.startsWith('/api/worker/')) return false;
	return agent.versionCode < release.minVersionCode;
}
