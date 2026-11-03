import { error, fail, redirect } from '@sveltejs/kit';
import { PHRASE_PATTERNS } from '$lib/labels';
import { getDb } from '$lib/server/db';
import { listPickExercises, logSet } from '$lib/server/exercises';
import { listCountTakesFor } from '$lib/server/countTakes';
import { listFiguresForCall } from '$lib/server/figures';
import { buildGraph } from '$lib/server/graph';
import { int, optionalInt, optionalText } from '$lib/server/form';
import { routineShapes } from '$lib/server/routines';
import { songChoices } from '$lib/server/songs';
import { practiceBack } from '$lib/player/view';
import { practiceStart } from '$lib/exercises/practice';
import {
	exerciseInWall,
	requireExerciseInWall,
	requireRoutineAccess,
	wallOf
} from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, params, locals }) => {
	const wall = wallOf(params, locals);
	const dance = wall.dance;
	const db = getDb();
	const songId = Number(url.searchParams.get('song')) || null;
	const bpm = Number(url.searchParams.get('bpm')) || null;
	const exerciseId = Number(url.searchParams.get('exercise')) || null;

	// This dance's ready songs only: a song from the other dance is no song at
	// all here, or `/salsa/player?song=` would play a bachata track under a
	// salsa count.
	const songs = songChoices(db, wall);
	if (songId && !songs.some((s) => s.id === songId)) {
		throw error(404, 'No analysed song here');
	}
	// Same id-scoping as the song: an exercise from the other dance is not this
	// player's to practise, so it comes back as "no exercise" rather than a run
	// that would log its set on the far side of the wall.
	const exercise = exerciseId ? exerciseInWall(db, wall, exerciseId) : null;

	const routineId = Number(url.searchParams.get('routine')) || null;
	// Same id-scoping as the song and the exercise: a routine of the other
	// dance, another person's, or a group's out of reach is not this player's
	// to walk. A group's routine the person reads is (their entry practises it).
	const found = routineId ? requireRoutineAccess(db, locals, params, routineId, 'read') : null;
	if (found && found.routine.archivedAt !== null) throw error(404, 'No such routine');
	const routine = found?.routine ?? null;
	// The routine's own space draws it: a group's routine names the group's
	// variations on the group's graph, never the member's own (risk 26).
	const space = found?.space ?? wall;
	const shape = routine ? (routineShapes(db, space).get(routine.id) ?? { slots: [] }) : null;
	// Every figure the routine can call: the run's pool, and what the voice has
	// a name for.
	const figureIds = shape
		? [
				...new Set(
					shape.slots.flatMap((s) =>
						s.kind === 'child' ? s.slots.flatMap((c) => c.figureIds) : s.figureIds
					)
				)
			]
		: [];

	const back = practiceBack({
		dance,
		from: url.searchParams.get('from'),
		routine: routine && { id: routine.id, name: routine.name },
		// The URL's `?song=`, not the exercise's memory: Back returns to the page
		// that opened Practice.
		song: songId ? { id: songId, title: songs.find((s) => s.id === songId)!.title } : null,
		exercise: exercise && {
			id: exercise.id,
			name: exercise.name,
			archived: exercise.archivedAt !== null
		}
	});

	return {
		back,
		// The picker's songs. The picked one's grid is fetched by the page, as the
		// popup's panel does, so changing song is not a navigation.
		songs,
		// Where the setup opens: `?song=`, else what the exercise was last
		// practised with, else the count.
		start: {
			...practiceStart(
				exercise,
				songs.map((s) => s.id),
				songId
			),
			bpm: exercise?.practiceMode === 'count' ? exercise.countBpm : null
		},
		bpm: bpm && bpm >= 60 && bpm <= 300 ? bpm : 180,
		routine: routine && shape ? { id: routine.id, name: routine.name, shape, figureIds } : null,
		// Names only, for `sayOf` and the on-screen call. Empty without a routine:
		// nothing else calls figures.
		callNames: listFiguresForCall(db, space, figureIds),
		// The position graph, which a routine is flattened and walked on.
		// Client-safe: `Graph` is plain data from a pure module.
		graph: buildGraph(db, space),
		exercise,
		exercises: listPickExercises(db, wall),
		// Every pattern's takes: which one the run uses is a client-side choice
		// made at Play, and there are only ever a few dozen rows.
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, wall.userId, p))
	};
};

export const actions: Actions = {
	/** Log the finished run as a set on the exercise it was practised for. */
	save: async ({ params, request, locals }) => {
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
		requireExerciseInWall(getDb(), wallOf(params, locals), exerciseId);
		try {
			logSet(getDb(), {
				exerciseId,
				doneAt: Date.now(),
				durationS,
				reps: null,
				rating,
				note,
				// The summary of what the run was is a nicety; the set is the point.
				// An overlong one (a marathon routine with a great many calls) is
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
