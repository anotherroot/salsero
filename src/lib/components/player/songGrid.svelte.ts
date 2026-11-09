/**
 * The picked song's grid, fetched from `GET /[dance]/songs/[id]/grid` as soon
 * as the song is picked — never on the Play tap, which must reach `start()`
 * without awaiting anything or iOS keeps the audio locked. Shared by the
 * practice panel and the full player. Call it while a component initialises:
 * the fetch lives in an `$effect`, a pick that changes mid-fetch drops the
 * stale answer, and the same song asked again keeps what it has.
 */
import type { SongGrid } from '$lib/types';
import { t } from '$lib/i18n/catalog';

export function loadSongGrid(
	danceSlug: () => string,
	/** The song to load, or null for none (count only). */
	songId: () => number | null
): { grid: SongGrid | null; error: string | null } {
	const state = $state<{ grid: SongGrid | null; error: string | null }>({
		grid: null,
		error: null
	});
	// What is loaded (or loading), as "dance/song". A page load that runs again
	// (a practice saved, the device's pull) hands the same song back: the grid
	// stays, so the page keeps the <audio> a run plays on. Only a newer pick's
	// answer is taken (`asked`).
	let current: string | null = null;
	let asked = 0;
	$effect(() => {
		const id = songId();
		const slug = danceSlug();
		const key = id === null ? null : `${slug}/${id}`;
		if (key === current) return;
		current = key;
		const mine = ++asked;
		state.grid = null;
		state.error = null;
		if (id === null) return;
		fetch(`/${slug}/songs/${id}/grid`)
			.then((r) =>
				r.ok ? (r.json() as Promise<SongGrid>) : Promise.reject(new Error(String(r.status)))
			)
			.then((g) => {
				if (mine === asked) state.grid = g;
			})
			.catch(() => {
				if (mine === asked) state.error = t().player.songFailed;
			});
	});
	return state;
}
