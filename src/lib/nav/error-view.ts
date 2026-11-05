import type { DanceSlug } from '$lib/dances/dances';
import type { IconName } from '$lib/icons/icons';
import { TABS, tabFor } from '$lib/nav/tabs';

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

/** What an error page says. `offline` wins over any status: the server was never reached. */
export function errorView(
	status: number,
	message: string | undefined,
	offline: boolean
): ErrorView {
	if (offline) {
		return {
			title: 'Offline',
			icon: 'refresh',
			tone: 'warn',
			heading: 'You’re offline',
			body: 'This page needs the server. Check the connection and try again; nothing you saved is lost.',
			code: null,
			retry: true,
			today: false
		};
	}
	const code = `ERROR ${status}`;
	const own = message && !GENERIC.has(message) ? message : null;
	if (status === 404) {
		return {
			title: 'Not found',
			icon: 'search',
			tone: 'accent',
			heading: own ?? 'Nothing here',
			body: 'This page does not exist, or what it showed was deleted.',
			code,
			retry: false,
			today: true
		};
	}
	if (status >= 500) {
		return {
			title: 'Error',
			icon: 'warning',
			tone: 'danger',
			heading: 'Something went wrong',
			body: 'The server could not open this page. Try again in a moment.',
			code,
			retry: true,
			today: true
		};
	}
	return {
		title: 'Error',
		icon: 'warning',
		tone: 'danger',
		heading: own ?? 'Something went wrong',
		body: 'Go back and try again.',
		code,
		retry: false,
		today: true
	};
}

/** Where Back goes: the tab the failed path belongs to, else Today. */
export function errorBack(path: string, dance: DanceSlug): { href: string; label: string } {
	const tab = TABS.find((t) => t.id === tabFor(path, dance)) ?? TABS[0];
	// A route id names its groups (`/[dance]/(moves)/figures`); the URL does not.
	const href = tab.path.replace(/\/\([^)]*\)/g, '').replace('[dance]', dance);
	return { href, label: `Back to ${tab.label}` };
}
