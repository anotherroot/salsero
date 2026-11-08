import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { figures } from '$lib/server/db/schema';
import { createPosition, positionSummary } from '$lib/server/positions';
import { requireFigureAccess } from '$lib/server/scope';
import { FACING, FRAME, HANDS } from '$lib/positions/hold';
import { DANCES, isDanceSlug } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import type { Hold } from '$lib/types';
import type { RequestHandler } from './$types';

const oneOf = <T extends string>(v: unknown, all: readonly T[]): T | null =>
	typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : null;

/**
 * A new position from a figure's Starts in / Ends in picker (ruling 9). JSON,
 * not a page action: the picker sits inside the figure's guarded form, and a
 * page action would submit it.
 *
 * Body `{ figureId, name, styleTag, hands?, crossed?, facing?, frame?, notes? }`.
 * The position is made in the figure's owner's space (a group's figure: the
 * group's, so its figure may be tagged with it, ruling 15), after the figure
 * is found editable by this person; anything else is the stranger's 404. A
 * taken or bad name is 400 `{ message, field: 'name' }` (notes over 2000
 * characters: `field: 'notes'`); 201 answers the new
 * row as a `PositionSummary`. A type outside the figure's dance and an
 * unknown hold part are dropped, as the positions page drops them.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, t().refusals.signIn);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const figureId = body?.figureId;
	const rawName = body?.name;
	if (
		!body ||
		typeof figureId !== 'number' ||
		!Number.isSafeInteger(figureId) ||
		typeof rawName !== 'string'
	) {
		throw error(400, t().refusals.badRequest);
	}
	const db = getDb();
	const row = db
		.select({ dance: figures.dance, archivedAt: figures.archivedAt })
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	if (!row || row.archivedAt !== null || !isDanceSlug(row.dance))
		throw error(404, t().refusals.figureNotFound);
	const { space } = requireFigureAccess(db, locals, { dance: row.dance }, figureId, 'edit');

	if (rawName.trim().length > 200) {
		return json({ message: t().positions.refused.nameLong, field: 'name' }, { status: 400 });
	}
	// The create step shows the same fields as New position, Notes included.
	const notes =
		typeof body.notes === 'string' && body.notes.trim() !== '' ? body.notes.trim() : null;
	if (notes !== null && notes.length > 2000) {
		return json({ message: t().positions.refused.notesLong, field: 'notes' }, { status: 400 });
	}
	const styleTag =
		typeof body.styleTag === 'string' && DANCES[space.dance].styles.includes(body.styleTag)
			? body.styleTag
			: null;
	const hold: Hold = {
		hands: oneOf(body.hands, HANDS),
		crossed: body.crossed === true ? true : null,
		facing: oneOf(body.facing, FACING),
		frame: oneOf(body.frame, FRAME)
	};
	const made = createPosition(
		db,
		space,
		{ name: rawName, styleTag, hold, notes, pictureSpotId: null },
		Date.now()
	);
	if ('field' in made) {
		return json({ message: made.message, field: made.field }, { status: 400 });
	}
	return json(positionSummary(made, space), { status: 201 });
};
