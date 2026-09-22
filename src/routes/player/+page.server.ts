import { error } from '@sveltejs/kit';
import { buildGrid } from '$lib/beatgrid/beatgrid';
import type { TempoFactor } from '$lib/labels';
import { getDb } from '$lib/server/db';
import { getExercise, listExercises } from '$lib/server/exercises';
import { listCallableFigures } from '$lib/server/figures';
import { getSong } from '$lib/server/songs';
import type { PageServerLoad } from './$types';

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
