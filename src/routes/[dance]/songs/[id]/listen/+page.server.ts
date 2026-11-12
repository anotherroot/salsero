import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { songGrid } from '$lib/server/grid';
import { requireSongAccess } from '$lib/server/scope';
import { musicStart } from '$lib/songs/music-start';
import { counted } from '$lib/songs/counted';
import { parseSections } from '$lib/songs/sections';
import { t } from '$lib/i18n/catalog';
import type { SongGrid } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * The listening player's song (spec 2026-11-10-hearing-drills-design.md). It
 * grades taps against the count, so only a count a person set will do: a song
 * with Beat This!'s guess alone is a 404, never a round that marks someone
 * wrong for the computer's mistake. Reads only the song, so the phone answers
 * it from its copy like the song page.
 */
export const load: PageServerLoad = ({ params, locals }) => {
	const { song } = requireSongAccess(getDb(), locals, params, params.id, 'read');
	if (song.status !== 'ready' || !song.audioFile) throw error(404, t().refusals.noAnalysedSong);
	if (!counted(song)) throw error(404, t().refusals.notCounted);
	const grid: SongGrid = {
		audioFile: song.audioFile,
		...songGrid(song),
		startS: musicStart(song),
		sections: parseSections(song.sectionsJson)
	};
	return { song: { id: song.id, title: song.title }, grid };
};
