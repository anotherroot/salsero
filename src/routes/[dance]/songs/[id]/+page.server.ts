import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText, text } from '$lib/server/form';
import {
	archiveSong,
	retrySong,
	setAnchors,
	setTempoFactor,
	updateSongMeta
} from '$lib/server/songs';
import {
	TAP_LATENCY_S,
	addAnchor,
	buildGrid,
	nearestBeat,
	removeAnchor,
	scaleBeats
} from '$lib/beatgrid/beatgrid';
import { TEMPO_FACTORS, type TempoFactor } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf, requireSongInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

/**
 * The song this URL names, or a 404.
 *
 * `getSong` is id-scoped, so without the dance test `/salsa/songs/7` would
 * happily render a bachata song and the URL would be lying about which dance
 * you are in. Every action below reaches the row by id too, so each goes
 * through here rather than trusting the id alone.
 */
function songOf(params: { dance: string; id: string }) {
	const song = requireSongInDance(getDb(), danceOf(params), Number(params.id));
	// Archived is gone from every list, so it is gone from its own URL too —
	// the one rule this page adds on top of the shared dance guard.
	if (song.archivedAt !== null) throw error(404, 'Song not found');
	return song;
}

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ params }) => {
	const song = songOf(params);
	const anchors = parse(song.anchorsJson);
	const grid =
		song.status === 'ready'
			? buildGrid({
					beats: parse(song.beatsJson),
					downbeats: parse(song.downbeatsJson),
					anchors,
					tempoFactor: song.tempoFactor as TempoFactor
				})
			: null;
	// Only what the page shows: the raw beat lists travel as `grid`, not twice.
	return {
		song: {
			id: song.id,
			title: song.title,
			artist: song.artist,
			style: song.style,
			sourceUrl: song.sourceUrl,
			status: song.status,
			error: song.error,
			audioFile: song.audioFile,
			tempoFactor: song.tempoFactor
		},
		anchors,
		grid
	};
};

export const actions: Actions = {
	/** A tap on "the 1" at playhead time `t`, snapped to the nearest beat after reaction-time compensation. */
	tap: async ({ params, request }) => {
		const song = songOf(params);
		const t = Number((await request.formData()).get('t'));
		if (!Number.isFinite(t) || song.status !== 'ready')
			return fail(400, { message: 'Play the song first.' });
		const beats = scaleBeats(parse(song.beatsJson), song.tempoFactor as TempoFactor);
		const i = nearestBeat(beats, t - TAP_LATENCY_S);
		if (i < 0) return fail(400, { message: 'No beats to snap to.' });
		setAnchors(getDb(), song.id, addAnchor(parse(song.anchorsJson), i));
		return { ok: true };
	},

	removeAnchor: async ({ params, request }) => {
		const song = songOf(params);
		const i = Number((await request.formData()).get('beat'));
		setAnchors(getDb(), song.id, removeAnchor(parse(song.anchorsJson), i));
		return { ok: true };
	},

	resetAnchors: ({ params }) => {
		setAnchors(getDb(), songOf(params).id, []);
		return { ok: true };
	},

	tempo: async ({ params, request }) => {
		const song = songOf(params);
		const f = Number((await request.formData()).get('factor'));
		if (!(TEMPO_FACTORS as readonly number[]).includes(f))
			return fail(400, { message: 'Bad tempo.' });
		setTempoFactor(getDb(), song.id, f as TempoFactor);
		return { ok: true };
	},

	update: async ({ params, request }) => {
		const song = songOf(params);
		const form = await request.formData();
		const title = text(form, 'title');
		const artist = optionalText(form, 'artist', 200);
		const style = oneOf(form, 'style', DANCES[danceOf(params)].styles);
		if (!title || artist === undefined || !style) {
			return fail(400, { message: 'Give the song a title (up to 200 characters).' });
		}
		updateSongMeta(getDb(), song.id, { title, artist, style });
		return { ok: true };
	},

	retry: ({ params }) => {
		if (!retrySong(getDb(), songOf(params).id)) {
			return fail(409, { message: 'Only a failed song can be retried.' });
		}
		return { ok: true };
	},

	archive: ({ params }) => {
		archiveSong(getDb(), songOf(params).id, Date.now());
		throw redirect(303, `/${params.dance}/songs`);
	}
};
