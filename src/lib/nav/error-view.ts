import type { DanceSlug } from '$lib/dances/dances';
import type { IconName } from '$lib/icons/icons';
import { t } from '$lib/i18n/catalog';
import { NEEDS_CONNECTION } from '$lib/offline/needs-connection';
import { tabFor } from '$lib/nav/tabs';
import { tabsFor, type Level } from '$lib/levels/levels';

export interface ErrorView {
	title: string;
	icon: IconName;
	tone: 'accent' | 'warn' | 'danger';
	heading: string;
	body: string;
	code: string | null;
	retry: boolean;
	today: boolean;
}

// SvelteKit's own words for a status; they say nothing a person can use.
const GENERIC = new Set(['Not Found', 'Internal Error', 'Error']);

/** What an error page says. `offline` wins over any status: the server was never reached (or the device could not answer: needs-connection). */
export function errorView(
	status: number,
	message: string | undefined,
	offline: boolean
): ErrorView {
	const w = t().shell.error;
	if (offline || message === NEEDS_CONNECTION) {
		return {
			title: w.offlineTitle,
			icon: 'refresh',
			tone: 'warn',
			heading: w.offlineHeading,
			body: w.offlineBody,
			code: null,
			retry: true,
			today: false
		};
	}
	const code = w.code(status);
	const own = message && !GENERIC.has(message) ? message : null;
	if (status === 404) {
		return {
			title: w.notFoundTitle,
			icon: 'search',
			tone: 'accent',
			heading: own ?? w.notFoundHeading,
			body: w.notFoundBody,
			// The band and the heading say it already (page changes spec, error screens).
			code: null,
			retry: false,
			today: true
		};
	}
	if (status >= 500) {
		return {
			title: w.title,
			icon: 'warning',
			tone: 'danger',
			heading: w.heading,
			body: w.serverBody,
			code,
			retry: true,
			today: true
		};
	}
	return {
		title: w.title,
		icon: 'warning',
		tone: 'danger',
		heading: own ?? w.heading,
		body: w.body,
		code,
		retry: false,
		today: true
	};
}

/** Where Back goes: the tab the failed path belongs to, when the level has it, else Today. */
export function errorBack(
	path: string,
	dance: DanceSlug,
	level: Level = 'all'
): { href: string; label: string } {
	const tabs = tabsFor(level);
	const tab = tabs.find((x) => x.id === tabFor(path, dance)) ?? tabs[0];
	// A route id names its groups (`/[dance]/(moves)/figures`); the URL does not.
	const href = tab.path.replace(/\/\([^)]*\)/g, '').replace('[dance]', dance);
	return { href, label: t().shell.backTo(tab.label) };
}
