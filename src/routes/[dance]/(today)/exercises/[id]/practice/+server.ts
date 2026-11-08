import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { setPracticeSettings } from '$lib/server/exercises';
import { practicePayload } from '$lib/server/practice-content';
import { requireExerciseInWall, wallOf } from '$lib/server/scope';
import { DANCES } from '$lib/dances/dances';
import { parsePracticeInput } from '$lib/exercises/practice';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';
import { serverNow } from '$lib/server/server-clock';

function exerciseOf(params: { dance: string; id: string }, locals: App.Locals) {
	const exercise = requireExerciseInWall(getDb(), wallOf(params, locals), Number(params.id));
	if (exercise.archivedAt !== null) throw error(404, 'No such exercise');
	return exercise;
}

/** What the log popup shows above its form. See `practice-content.ts`. */
export const GET: RequestHandler = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	return json(
		practicePayload(getDb(), exerciseOf(params, locals), locals.user.timezone, serverNow())
	);
};

/**
 * Remember what the practice panel played, posted on Play. An endpoint rather
 * than a form action so the four pages that open a popup need not each
 * register one. JSON, so SvelteKit's form-CSRF check does not apply — and a
 * cross-site page cannot send a JSON body without a CORS preflight this server
 * never answers.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const exercise = exerciseOf(params, locals);
	const input = parsePracticeInput(
		await request.json().catch(() => null),
		DANCES[wallOf(params, locals).dance]
	);
	if (!input || !setPracticeSettings(getDb(), exercise.id, input)) {
		throw error(400, 'Those practice settings cannot be used');
	}
	// A drill's practice is one of its fields: Keep in step's flow runs from it
	// (an exercise that is no drill is in no family, so nothing runs).
	await flowAfter(locals.user?.id, 'drill', exercise.id);
	return new Response(null, { status: 204 });
};
