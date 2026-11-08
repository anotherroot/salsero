import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { figures, exercises, positions, routines } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { editsTeam } from '$lib/server/trash';
import { restoreVariation } from '$lib/server/figures';
import { restoreRoutine } from '$lib/server/routines';
import { restoreDrill } from '$lib/server/exercises';
import { restorePositionIn } from '$lib/server/positions';
import type { TeamSpace } from '$lib/server/scope';
import type { RequestHandler } from './$types';

const KEYS = ['figureId', 'routineId', 'exerciseId', 'positionId'] as const;

/** The one id a body names: a variation, a routine, a drill or a position. */
function targetOf(body: unknown) {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;
	const keys = KEYS.filter((k) => k in b);
	if (keys.length !== 1) return null;
	const id = b[keys[0]];
	if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
	return { key: keys[0], id };
}

/**
 * Restore what a picker offered and someone archived since ("Archived by
 * Ana · Restore"): a group's variation, routine, drill or position, for that
 * group's editors. Anyone else, a person's own thing and a missing id get the
 * same 404. A refusal (its name is taken now) is a 409 with its words.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const target = targetOf(await request.json().catch(() => null));
	if (!target) throw error(400, t().refusals.sayWhatToRestore);
	const db = getDb();
	const table = {
		figureId: figures,
		routineId: routines,
		exerciseId: exercises,
		positionId: positions
	}[target.key];
	const row = db
		.select({ dance: table.dance, teamId: table.teamId })
		.from(table)
		.where(eq(table.id, target.id))
		.get();
	const userId = locals.user?.id;
	if (!row || row.teamId === null || !userId || !editsTeam(db, userId, row.teamId)) {
		throw error(404, t().links.refused.nothingToRestore);
	}
	const space = { dance: row.dance, teamId: row.teamId, actorId: userId } as TeamSpace;
	const restore = {
		figureId: restoreVariation,
		routineId: restoreRoutine,
		exerciseId: restoreDrill,
		positionId: restorePositionIn
	}[target.key];
	const done = restore(db, space, target.id, Date.now());
	if (done.ok) return json({ ok: true });
	if (done.reason === 'gone') throw error(404, t().links.refused.nothingToRestore);
	return json({ message: done.message }, { status: 409 });
};
