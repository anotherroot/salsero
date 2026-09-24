import { error, fail, redirect } from '@sveltejs/kit';
import { buildGrid } from '$lib/beatgrid/beatgrid';
import { PHRASE_PATTERNS, type TempoFactor } from '$lib/labels';
import { getDb } from '$lib/server/db';
import { listExercises, logSet } from '$lib/server/exercises';
import { listCountTakesFor } from '$lib/server/countTakes';
import { listCallableFigures } from '$lib/server/figures';
import { int, optionalInt, optionalText } from '$lib/server/form';
import { getSong } from '$lib/server/songs';
import { danceOf, exerciseInDance, requireExerciseInDance } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ url, params }) => {
	const dance = danceOf(params);
	const db = getDb();
	const songId = Number(url.searchParams.get('song')) || null;
	const bpm = Number(url.searchParams.get('bpm')) || null;
	const exerciseId = Number(url.searchParams.get('exercise')) || null;

	const song = songId ? getSong(db, songId) : null;
	// `getSong` is id-scoped: a song from the other dance is no song at all here,
	// or `/salsa/player?song=` would play a bachata track under a salsa count.
	if (
		songId &&
		(!song || song.archivedAt !== null || song.status !== 'ready' || song.dance !== dance)
	) {
		throw error(404, 'No analysed song here');
	}

	return {
		song: song && { id: song.id, title: song.title, audioFile: song.audioFile },
		grid: song
			? buildGrid({
					beats: parse(song.beatsJson),
					downbeats: parse(song.downbeatsJson),
					anchors: parse(song.anchorsJson),
					tempoFactor: song.tempoFactor as TempoFactor
				})
			: null,
		bpm: bpm && bpm >= 60 && bpm <= 300 ? bpm : song ? null : 180,
		figures: listCallableFigures(db, dance),
		// Same id-scoping as the song: an exercise from the other dance is not
		// this player's to practise, so it comes back as "no exercise" rather
		// than a run that would log its set on the far side of the wall.
		exercise: exerciseId ? exerciseInDance(db, dance, exerciseId) : null,
		exercises: listExercises(db, dance).map((e) => ({ id: e.id, name: e.name })),
		// Every pattern's takes: which one the run uses is a client-side choice
		// made at Play, and there are only ever a few dozen rows.
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, p))
	};
};

export const actions: Actions = {
	/** Log the finished run as a set on the exercise it was practised for. */
	save: async ({ params, request }) => {
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const durationS = optionalInt(form, 'durationS', 0, 24 * 3600);
		const rating = optionalInt(form, 'rating', 1, 5);
		const note = optionalText(form, 'note', 2000);
		const run = optionalText(form, 'run', 4000);

		// Echoed back on failure so the sheet can keep what was entered.
		const entered = {
			exerciseId: exerciseId ?? null,
			rating: rating ?? null,
			note: String(form.get('note') ?? '')
		};

		if (exerciseId === undefined || durationS === undefined || rating === undefined) {
			return fail(400, { message: 'Could not save that run.', ...entered });
		}
		if (note === undefined) {
			return fail(400, {
				message: 'That note is too long — keep it under 2000 characters.',
				...entered
			});
		}
		// The run is logged by id, so the id is checked against this dance: the
		// sheet only ever offers this dance's exercises, and a posted id must not
		// be able to reach past that.
		requireExerciseInDance(getDb(), danceOf(params), exerciseId);
		try {
			logSet(getDb(), {
				exerciseId,
				doneAt: Date.now(),
				durationS,
				reps: null,
				rating,
				note,
				// The summary of what the run was is a nicety; the set is the point.
				// An overlong one (a marathon drill with a great many calls) is
				// dropped rather than costing the user the whole session — and it
				// must never be reported as a problem with their note.
				playerJson: run ?? null
			});
		} catch {
			return fail(400, { message: 'That exercise no longer exists.', ...entered });
		}
		throw redirect(303, `/${params.dance}`);
	}
};
