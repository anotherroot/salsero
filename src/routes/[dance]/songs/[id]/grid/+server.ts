import { t } from '$lib/i18n/catalog';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songGrid } from '$lib/server/grid';
import { requireSongAccess } from '$lib/server/scope';
import { musicStart } from '$lib/songs/music-start';
import type { SongGrid } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * A song's grid for the practice panel, fetched when a song is picked — never
 * on the Play tap, which must reach `start()` without awaiting anything (iOS).
 * Under `/[dance]/` so the slug is in the URL and the wall applies unchanged.
 * Read access is enough: a member practises to a group's shared song.
 */
export const GET: RequestHandler = ({ params, locals }) => {
	const { song } = requireSongAccess(getDb(), locals, params, params.id, 'read');
	if (song.status !== 'ready' || !song.audioFile) {
		throw error(404, t().refusals.noAnalysedSong);
	}
	const body: SongGrid = { audioFile: song.audioFile, ...songGrid(song), startS: musicStart(song) };
	return json(body);
};
