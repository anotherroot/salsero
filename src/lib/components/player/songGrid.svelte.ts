/**
 * The picked song's grid, fetched from `GET /[dance]/songs/[id]/grid` as soon
 * as the song is picked — never on the Play tap, which must reach `start()`
 * without awaiting anything or iOS keeps the audio locked. Shared by the
 * practice panel and the full player. Call it while a component initialises:
 * the fetch lives in an `$effect`, and a pick that changes mid-fetch drops the
 * stale answer.
 */
import type { SongGrid } from '$lib/types';

export function loadSongGrid(
	danceSlug: () => string,
	/** The song to load, or null for none (count only). */
	songId: () => number | null
): { grid: SongGrid | null; error: string | null } {
	const state = $state<{ grid: SongGrid | null; error: string | null }>({
		grid: null,
		error: null
	});
	$effect(() => {
		const id = songId();
		const slug = danceSlug();
		state.grid = null;
		state.error = null;
		if (id === null) return;
		let cancelled = false;
		fetch(`/${slug}/songs/${id}/grid`)
			.then((r) =>
				r.ok ? (r.json() as Promise<SongGrid>) : Promise.reject(new Error(String(r.status)))
			)
			.then((g) => {
				if (!cancelled) state.grid = g;
			})
			.catch(() => {
				if (!cancelled)
					state.error = 'That song could not be loaded. Pick another, or use the count.';
			});
		return () => {
			cancelled = true;
		};
	});
	return state;
}
