/**
 * Mirror and speed for videos, remembered per browser. A per-viewer
 * convenience, so `localStorage` is the right place — and every access is
 * wrapped, because private-mode Safari throws on any touch of it. Nothing here
 * ever reaches the database.
 */
export const VIDEO_RATES = [0.5, 0.75, 1] as const;
export type VideoRate = (typeof VIDEO_RATES)[number];

export interface VideoPrefs {
	mirror: boolean;
	rate: VideoRate;
}

const KEY = 'video.prefs';
const DEFAULTS: VideoPrefs = { mirror: false, rate: 1 };

export function parseVideoPrefs(raw: string | null): VideoPrefs {
	try {
		const v: unknown = raw ? JSON.parse(raw) : null;
		if (!v || typeof v !== 'object') return DEFAULTS;
		const o = v as Record<string, unknown>;
		return {
			mirror: o.mirror === true,
			rate: (VIDEO_RATES as readonly unknown[]).includes(o.rate) ? (o.rate as VideoRate) : 1
		};
	} catch {
		return DEFAULTS;
	}
}

export function loadVideoPrefs(): VideoPrefs {
	try {
		return parseVideoPrefs(localStorage.getItem(KEY));
	} catch {
		return DEFAULTS;
	}
}

export function saveVideoPrefs(p: VideoPrefs): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		// Private mode or storage full: the choice just is not remembered.
	}
}
