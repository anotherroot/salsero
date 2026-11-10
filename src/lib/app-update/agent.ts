/**
 * What the app and the server tell each other about versions, as pure
 * client-safe parsing: the user agent suffix and the `x-app-version` header
 * the Android app sends, the `current.json` a release publishes, and whether
 * an app needs an update. Nothing here reads a file or the network.
 */
import { isDanceSlug, type DanceSlug } from '$lib/dances/dances';

export type Channel = 'direct' | 'play';

export interface AppAgent {
	versionCode: number;
	dance: DanceSlug;
	channel: Channel;
}

export interface Release {
	versionCode: number;
	versionName: string;
	minVersionCode: number;
	sha256: string;
	size: number;
	commit: string;
}

export type UpdateState = 'none' | 'available' | 'required';
export type Device = 'android' | 'ios' | 'other';

function agentOf(code: string, dance: string, channel: string): AppAgent | null {
	if (!/^\d+$/.test(code) || !isDanceSlug(dance)) return null;
	if (channel !== 'direct' && channel !== 'play') return null;
	return { versionCode: Number(code), dance, channel };
}

/** ` SalsaApp/<versionCode> (<dance>; <channel>)` at the end of the user agent. */
export function parseAppAgent(ua: string | null): AppAgent | null {
	const m = ua?.match(/SalsaApp\/(\d+) \(([a-z]+); ([a-z]+)\)/);
	return m ? agentOf(m[1], m[2], m[3]) : null;
}

/**
 * The page's own word for which app it runs in: the `SalsaApp/…` part of its user
 * agent, sent by app.html's fetch wrapper. The Android app's service worker has no
 * user agent of its own to set, so a request it sends on reaches the server without
 * the app's; the hook reads this one then.
 */
export const APP_HEADER = 'x-salsa-app';

/** `x-app-version: <versionCode>; <dance>; <channel>` */
export function parseAppVersion(header: string | null): AppAgent | null {
	const m = header?.trim().match(/^(\d+); ([a-z]+); ([a-z]+)$/);
	return m ? agentOf(m[1], m[2], m[3]) : null;
}

function count(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** The `current.json` of a release; null when any key is missing, mistyped or negative. */
export function parseRelease(json: unknown): Release | null {
	if (typeof json !== 'object' || json === null) return null;
	const j = json as Record<string, unknown>;
	if (
		!count(j.versionCode) ||
		!count(j.minVersionCode) ||
		!count(j.size) ||
		typeof j.versionName !== 'string' ||
		typeof j.sha256 !== 'string' ||
		typeof j.commit !== 'string'
	) {
		return null;
	}
	return {
		versionCode: j.versionCode,
		versionName: j.versionName,
		minVersionCode: j.minVersionCode,
		sha256: j.sha256,
		size: j.size,
		commit: j.commit
	};
}

/** Below the minimum is required; behind the latest is available, except on Play, which updates itself. */
export function updateState(agent: AppAgent, release: Release | null): UpdateState {
	if (!release) return 'none';
	if (agent.versionCode < release.minVersionCode) return 'required';
	if (agent.channel === 'play') return 'none';
	return agent.versionCode < release.versionCode ? 'available' : 'none';
}

export function deviceOf(ua: string | null): Device {
	if (!ua) return 'other';
	if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
	if (/Android/.test(ua)) return 'android';
	return 'other';
}
