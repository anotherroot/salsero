import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseRelease, type Release } from '$lib/app-update/agent';
import type { DanceSlug } from '$lib/dances/dances';
import { releasesDir } from '$lib/server/files';

export function apkPath(dir: string, dance: DanceSlug, versionCode: number): string {
	return join(dir, dance, `${versionCode}.apk`);
}

/** `<dir>/<dance>/current.json`, or null when it is missing, broken, or its APK is not on disk. */
export function readRelease(dir: string, dance: DanceSlug): Release | null {
	try {
		const release = parseRelease(
			JSON.parse(readFileSync(join(dir, dance, 'current.json'), 'utf8'))
		);
		return release && existsSync(apkPath(dir, dance, release.versionCode)) ? release : null;
	} catch {
		return null;
	}
}

const cache = new Map<string, { mtime: number; release: Release | null }>();

/** The dance's current release, re-read when `current.json` changes. */
export function currentRelease(dance: DanceSlug): Release | null {
	const dir = releasesDir();
	const file = join(dir, dance, 'current.json');
	let mtime = -1;
	try {
		mtime = statSync(file).mtimeMs;
	} catch {
		/* missing */
	}
	const key = `${dir}|${dance}`;
	const hit = cache.get(key);
	if (hit && hit.mtime === mtime) return hit.release;
	const release = readRelease(dir, dance);
	cache.set(key, { mtime, release });
	return release;
}

/**
 * When a release came out: its APK's time on disk (put there by the release
 * script, and never touched again). Null when that APK is not on disk.
 */
export function releasedAt(dance: DanceSlug, versionCode: number, dir?: string): number | null {
	// Inside the try: on the phone (device first) there is no disk, and no releases.
	try {
		return Math.round(statSync(apkPath(dir ?? releasesDir(), dance, versionCode)).mtimeMs);
	} catch {
		return null;
	}
}
