import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songGrid } from '$lib/server/grid';
import { danceOf, requireSongInDance } from '$lib/server/scope';
import type { SongGrid } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * A song's grid for the practice panel, fetched when a song is picked — never
 * on the Play tap, which must reach `start()` without awaiting anything (iOS).
 * Under `/[dance]/` so the slug is in the URL and the wall applies unchanged.
 */
export const GET: RequestHandler = ({ params }) => {
	const song = requireSongInDance(getDb(), danceOf(params), Number(params.id));
	if (song.archivedAt !== null || song.status !== 'ready' || !song.audioFile) {
		throw error(404, 'No analysed song here');
	}
	const body: SongGrid = { audioFile: song.audioFile, ...songGrid(song) };
	return json(body);
};
