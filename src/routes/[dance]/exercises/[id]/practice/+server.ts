import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { setPracticeSettings } from '$lib/server/exercises';
import { practicePayload } from '$lib/server/practice-content';
import { danceOf, requireExerciseInDance } from '$lib/server/scope';
import { DANCES } from '$lib/dances/dances';
import { parsePracticeInput } from '$lib/exercises/practice';
import type { RequestHandler } from './$types';

function exerciseOf(params: { dance: string; id: string }) {
	const exercise = requireExerciseInDance(getDb(), danceOf(params), Number(params.id));
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

/** What the log popup shows above its form. See `practice-content.ts`. */
export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	return json(practicePayload(getDb(), exerciseOf(params), locals.user.timezone, Date.now()));
};

/**
 * Remember what the practice panel played, posted on Play. An endpoint rather
 * than a form action so the four pages that open a popup need not each
 * register one. JSON, so SvelteKit's form-CSRF check does not apply — and a
 * cross-site page cannot send a JSON body without a CORS preflight this server
 * never answers.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const exercise = exerciseOf(params);
	const input = parsePracticeInput(await request.json().catch(() => null), DANCES[danceOf(params)]);
	if (!input || !setPracticeSettings(getDb(), exercise.id, input)) {
		throw error(400, 'Those practice settings cannot be used');
	}
	return new Response(null, { status: 204 });
};
