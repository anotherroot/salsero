import { error, fail, redirect } from '@sveltejs/kit';
import { buildGrid } from '$lib/beatgrid/beatgrid';
import type { TempoFactor } from '$lib/labels';
import { getDb } from '$lib/server/db';
import { getExercise, listExercises, logSet } from '$lib/server/exercises';
import { listCallableFigures } from '$lib/server/figures';
import { int, optionalInt, optionalText } from '$lib/server/form';
import { getSong } from '$lib/server/songs';
import type { Actions, PageServerLoad } from './$types';

const parse = (json: string | null): number[] => (json ? (JSON.parse(json) as number[]) : []);

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const songId = Number(url.searchParams.get('song')) || null;
	const bpm = Number(url.searchParams.get('bpm')) || null;
	const exerciseId = Number(url.searchParams.get('exercise')) || null;

	const song = songId ? getSong(db, songId) : null;
	if (songId && (!song || song.archivedAt !== null || song.status !== 'ready')) {
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
		figures: listCallableFigures(db),
		exercise: exerciseId ? getExercise(db, exerciseId) : null,
		exercises: listExercises(db).map((e) => ({ id: e.id, name: e.name }))
	};
};

export const actions: Actions = {
	/** Log the finished run as a set on the exercise it was practised for. */
	save: async ({ request }) => {
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
		throw redirect(303, '/');
	}
};
