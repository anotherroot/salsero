/**
 * Which build of the website this page runs, for Settings → About and the
 * deploy script's last line. Client-safe.
 *
 * The version is the number of commits behind the build (`git rev-list --count
 * HEAD`, set in vite.config.ts): it only goes up, by a few per publish. The
 * date is SvelteKit's own version name, the build's start in epoch ms; a build
 * is made right before it is published (`scripts/deploy.sh`).
 */
import { version } from '$app/environment';

export const SITE_VERSION: number = typeof __SITE_VERSION__ === 'number' ? __SITE_VERSION__ : 0;

export const SITE_BUILT_AT: number = Number(version) || 0;
