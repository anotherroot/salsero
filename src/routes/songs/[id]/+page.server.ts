import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { oneOf, optionalText, text } from '$lib/server/form';
import {
	archiveSong,
	getSong,
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
import { STYLES, TEMPO_FACTORS, type TempoFactor } from '$lib/labels';
import type { Actions, PageServerLoad } from './$types';

function load_(id: string) {
	const song = getSong(getDb(), Number(id));
	if (!song || song.archivedAt !== null) throw error(404, 'Song not found');
	return song;
}

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ params }) => {
	const song = load_(params.id);
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
	return { song, anchors, grid };
};

export const actions: Actions = {
	/** A tap on "the 1" at playhead time `t`, snapped to the nearest beat after reaction-time compensation. */
	tap: async ({ params, request }) => {
		const song = load_(params.id);
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
		const song = load_(params.id);
		const i = Number((await request.formData()).get('beat'));
		setAnchors(getDb(), song.id, removeAnchor(parse(song.anchorsJson), i));
		return { ok: true };
	},

	resetAnchors: ({ params }) => {
		setAnchors(getDb(), load_(params.id).id, []);
		return { ok: true };
	},

	tempo: async ({ params, request }) => {
		const song = load_(params.id);
		const f = Number((await request.formData()).get('factor'));
		if (!(TEMPO_FACTORS as readonly number[]).includes(f))
			return fail(400, { message: 'Bad tempo.' });
		setTempoFactor(getDb(), song.id, f as TempoFactor);
		return { ok: true };
	},

	update: async ({ params, request }) => {
		const song = load_(params.id);
		const form = await request.formData();
		const title = text(form, 'title');
		const artist = optionalText(form, 'artist', 200);
		const style = oneOf(form, 'style', STYLES);
		if (!title || artist === undefined || !style) {
			return fail(400, { message: 'Give the song a title (up to 200 characters).' });
		}
		updateSongMeta(getDb(), song.id, { title, artist, style });
		return { ok: true };
	},

	retry: ({ params }) => {
		retrySong(getDb(), load_(params.id).id);
		return { ok: true };
	},

	archive: ({ params }) => {
		archiveSong(getDb(), load_(params.id).id, Date.now());
		throw redirect(303, '/songs');
	}
};
