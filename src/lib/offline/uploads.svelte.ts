/*
 * Uploads of phone-only videos in flight (offline phase 4c), by file name, so
 * the Where button shows how far wherever the video is drawn, across pages.
 */
import { SvelteMap } from 'svelte/reactivity';

const running = new SvelteMap<string, number>();
// Never drawn: only joins a second start to the first.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const pending = new Map<string, Promise<void>>();

/** How far the file's upload is (0–100), or null when none runs. */
export function uploadOf(file: string): number | null {
	return running.get(file) ?? null;
}

/** Runs `run` for the file once at a time; a second start while one runs joins it. */
export function startUpload(
	file: string,
	run: (onPct: (pct: number) => void) => Promise<void>
): Promise<void> {
	const already = pending.get(file);
	if (already) return already;
	running.set(file, 0);
	const p = run((pct) => running.set(file, Math.max(0, Math.min(100, Math.round(pct))))).finally(
		() => {
			running.delete(file);
			pending.delete(file);
		}
	);
	pending.set(file, p);
	return p;
}

/** A progress the app reports (Android, offline phase 4c part 2): shown, or gone when done. */
export function noteUpload(file: string, pct: number | null): void {
	if (pct === null) running.delete(file);
	else running.set(file, Math.max(0, Math.min(100, Math.round(pct))));
}
