/**
 * What the Update button and the Update needed screen show. PURE: the native
 * bridge's messages in, words out. Client-safe.
 */
import type { DanceSlug } from '$lib/dances/dances';
import type { Channel, UpdateState } from './agent';
// Type only: fresh.ts reads BUSY_ROUTES from here.
import type { Quiet } from '$lib/nav/fresh';

export interface AppUpdate {
	state: UpdateState;
	channel: Channel;
	dance: DanceSlug;
	installed: number;
	latest: { versionCode: number; versionName: string; url: string } | null;
}

export type BridgeStatus =
	| 'idle'
	| { progress: number }
	| 'confirming'
	| 'permission'
	| 'busy'
	| 'current'
	| 'cancelled'
	| 'failed:offline'
	| 'failed:download'
	| 'failed:check'
	| 'failed:install';

/** Pages where Update needed never interrupts: Practice and recording a count. */
export const BUSY_ROUTES = ['/[dance]/player', '/voice'] as const;

const WORDS: Record<string, BridgeStatus> = {
	confirming: 'confirming',
	permission: 'permission',
	busy: 'busy',
	current: 'current',
	cancelled: 'cancelled',
	'failed:offline': 'failed:offline',
	'failed:download': 'failed:download',
	'failed:check': 'failed:check',
	'failed:install': 'failed:install'
};

/** A message from the native side; null when it is not one of ours. */
export function parseBridge(message: string): BridgeStatus | null {
	const m = message.match(/^progress:(\d{1,3})$/);
	if (m) {
		const progress = Number(m[1]);
		return progress <= 100 ? { progress } : null;
	}
	return Object.hasOwn(WORDS, message) ? WORDS[message] : null;
}

export function updateView(status: BridgeStatus): {
	label: string;
	working: boolean;
	line: string | null;
} {
	if (typeof status === 'object') {
		return { label: `Downloading… ${status.progress}%`, working: true, line: null };
	}
	switch (status) {
		case 'confirming':
			return { label: 'Installing…', working: true, line: null };
		case 'permission':
			return {
				label: 'Update',
				working: false,
				line: 'Allow this app to install updates, then come back.'
			};
		case 'busy':
			return { label: 'Update', working: true, line: 'Updating after your upload finishes.' };
		case 'current':
			return { label: 'Update', working: false, line: 'You have the latest version.' };
		case 'failed:offline':
			return { label: 'Try again', working: false, line: 'No connection.' };
		case 'failed:download':
			return { label: 'Try again', working: false, line: 'The download broke.' };
		case 'failed:check':
			return { label: 'Try again', working: false, line: "The download didn't check out." };
		case 'failed:install':
			return { label: 'Try again', working: false, line: "It didn't install." };
		default:
			return { label: 'Update', working: false, line: null };
	}
}

/** The full-screen block, instead of the page, except where leaving would lose work. */
export function showsUpdateNeeded(update: AppUpdate | null, routeId: string | null): boolean {
	if (update?.state !== 'required') return false;
	return !(BUSY_ROUTES as readonly (string | null)[]).includes(routeId);
}

/**
 * Whether the Update needed screen has the page now. It replaces the whole
 * tree, so it comes at a page load or a finished navigation (`at`: `load`,
 * `navigated`), never over Practice or My count. When the answer turns
 * required while a page sits open (`refresh`: coming back to the app), it
 * takes the page at once only if that cuts nothing short (the same rule as a
 * reload by itself, `mayReloadNow` in `$lib/nav/fresh.ts`); otherwise the
 * next navigation does.
 * Once up it stays while the update is required (`shown`), and goes when it no
 * longer is.
 */
export function updateNeededNow(
	update: AppUpdate | null,
	s: { routeId: string | null; shown: boolean; at: 'load' | 'navigated' | 'refresh' } & Quiet
): boolean {
	if (update?.state !== 'required') return false;
	if (s.shown) return true;
	if (!showsUpdateNeeded(update, s.routeId)) return false;
	if (s.at !== 'refresh') return true;
	return !s.playerOpen && !s.sheetsOpen && s.unsaved === 0 && s.held === 0;
}
