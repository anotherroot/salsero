import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	addFigureExercise,
	archiveFigure,
	createVariation,
	deleteRecording,
	figureLabels,
	getFigure,
	listVariations,
	listVersions,
	updateFigure,
	updateVariation,
	variationNameTaken
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { int, ints, oneOf, optionalInt, optionalText, text } from '$lib/server/form';
import { buildGraph, figurePositions, setFigureShape } from '$lib/server/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount,
	MAX_LENGTH_COUNTS
} from '$lib/graph/timing';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { getPosition, listPositions } from '$lib/server/positions';
import { addLinkFrom, deleteLinkFrom } from '$lib/server/link-form';
import { listLinks } from '$lib/server/links';
import { taughtIn } from '$lib/server/lessons';
import { popupData } from '$lib/server/popup';
import { endOf, figureById, follows, precedes, startsOf } from '$lib/graph/graph';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

function figureId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw error(404, 'Figure not found');
	return id;
}

function zoneOf(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * The FIGURE this URL names, or a 404.
 *
 * `getFigure` is id-scoped, so nothing but this stops `/salsa/figures/7` from
 * rendering a bachata figure — a hole straight through the dance wall. A
 * variation's own id is not a figure page: `load` redirects it to its figure
 * first, and every action posts to the figure's URL, so here it is a 404.
 */
function figureOf(params: { dance: string; id: string }) {
	const dance = danceOf(params);
	const found = getFigure(getDb(), figureId(params.id));
	if (
		!found ||
		found.figure.archivedAt !== null ||
		found.figure.dance !== dance ||
		found.figure.parentId !== null
	) {
		throw error(404, 'Figure not found');
	}
	return found;
}

type Found = NonNullable<ReturnType<typeof getFigure>>;

/**
 * One of THIS figure's versions, by the id posted with a form: the figure
 * itself, or one of its unarchived variations. Anything else — a variation of
 * another figure, of another dance, archived — is a 404, because the id in a
 * form body is just a number.
 */
function versionOf(found: Found, raw: number | undefined): Found {
	if (raw === undefined || raw === found.figure.id) return found;
	const v = getFigure(getDb(), raw);
	if (!v || v.figure.parentId !== found.figure.id || v.figure.archivedAt !== null) {
		throw error(404, 'Figure not found');
	}
	return v;
}

/** `versionOf`, for actions that only make sense on a variation. */
function variationOf(found: Found, raw: number | undefined): Found {
	const v = versionOf(found, raw);
	if (v.figure.parentId === null) throw error(404, 'Figure not found');
	return v;
}

export const load: PageServerLoad = ({ params, url, locals }) => {
	const dance = danceOf(params);
	const db = getDb();

	// A variation's own URL — from a routine, a "Leads to" list, an old link —
	// lands on its figure with its tab chosen. Only within the dance: a bachata
	// variation under /salsa/ falls through to `figureOf`'s 404.
	const direct = getFigure(db, figureId(params.id));
	if (
		direct &&
		direct.figure.parentId !== null &&
		direct.figure.dance === dance &&
		direct.figure.archivedAt === null
	) {
		throw redirect(303, `/${dance}/figures/${direct.figure.parentId}?v=${direct.figure.id}`);
	}

	const found = figureOf(params);
	const variations = listVariations(db, found.figure.id);
	// A ?v= that is not one of THIS figure's live variations shows Basic.
	const chosen = variations.find((v) => v.id === Number(url.searchParams.get('v'))) ?? null;
	const version = chosen ? getFigure(db, chosen.id)! : found;
	const versionId = version.figure.id;

	const graph = buildGraph(db, dance);
	const node = figureById(graph, versionId);
	const labels = figureLabels(db, dance);
	const parentOf = new Map(listVersions(db, dance).map((v) => [v.id, v.parentId]));
	// Live figures and variations only, never the version itself.
	const link = (ids: number[]) =>
		ids
			.filter((id) => id !== versionId && parentOf.has(id))
			.map((id) => ({ id, parentId: parentOf.get(id) ?? null, name: labels.get(id)! }));

	const tags = figurePositions(db, versionId);
	const live = listPositions(db, dance);
	const liveIds = new Set(live.map((p) => p.id));
	// An archived position stays referenced by the figures tagged with it (the
	// routines design doc's rule): if THIS version points at one, splice it back
	// into the list the pickers render — after the live rows, flagged — so a Save
	// that touches nothing else does not silently drop it. `setFigureShape`
	// accepts an archived id back; this is what lets the page resubmit it.
	const taggedIds = [...tags.startIds, ...(tags.endId === null ? [] : [tags.endId])];
	const archivedTagged = [...new Set(taggedIds)]
		.filter((id) => !liveIds.has(id))
		.map((id) => getPosition(db, id))
		.filter((p): p is NonNullable<typeof p> => p !== null && p.dance === dance);

	const basic = {
		startCount: found.figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: found.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};

	return {
		figure: found.figure,
		exercise: found.exercise,
		versions: [
			{ id: found.figure.id, name: 'Basic' },
			...variations.map((v) => ({ id: v.id, name: v.name }))
		],
		version: {
			id: versionId,
			name: version.figure.name,
			notes: version.figure.notes,
			isVariation: chosen !== null,
			recordings: version.recordings
		},
		positions: [
			...live.map((p) => ({ id: p.id, name: p.name, neutral: p.neutral, archived: false })),
			...archivedTagged.map((p) => ({
				id: p.id,
				name: p.name,
				neutral: p.neutral,
				archived: true
			}))
		],
		tags,
		// What the edit form shows: the version's OWN columns. On a variation a
		// null means "same as Basic"; on Basic the resolved values stand in.
		own: chosen
			? { startCount: version.figure.startCount, lengthCounts: version.figure.lengthCounts }
			: basic,
		basic,
		// What is actually danced, filled from Basic and with neutral resolved.
		effective: {
			starts: node ? startsOf(graph, node) : [],
			end: node ? endOf(graph, node) : null,
			startCount: node?.start ?? basic.startCount,
			lengthCounts: node?.length ?? basic.lengthCounts
		},
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, versionId)),
		followsFrom: link(precedes(graph, versionId)),
		links: listLinks(db, { figureId: found.figure.id }),
		taughtIn: taughtIn(db, found.figure.id),
		popup: found.exercise
			? popupData(db, dance, found.exercise.id, zoneOf(locals), Date.now())
			: null
	};
};

export const actions: Actions = {
	/**
	 * The figure page's one Save: details, positions and timing together.
	 *
	 * `setFigureShape` runs FIRST because it is the half that can refuse — a
	 * position of another dance. Running `updateFigure` first would rename the
	 * figure and then report the refusal, which is the half-written save this
	 * single form exists to rule out.
	 */
	update: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[danceOf(params)].styles);
		const notes = optionalText(form, 'notes');
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!name || !partner || !style || notes === undefined) {
			return fail(400, {
				action: 'update',
				message: 'Give the figure a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'update', message: 'Pick an end position.' });
		}
		if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'update',
				message: `A figure starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts.`
			});
		}

		const db = getDb();
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance, and that is a 404 rather than a message, the same answer
		// every other cross-dance id gets here.
		if (!setFigureShape(db, found.figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		if (!updateFigure(db, found.figure.id, { name, partner, style, notes })) {
			throw error(404, 'Figure not found');
		}
		return { action: 'update', ok: true };
	},

	createVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				action: 'createVariation',
				message: 'Give the variation a name (up to 200 characters).'
			});
		}
		const made = createVariation(getDb(), found.figure.id, { name, notes });
		if (!made) {
			return fail(400, {
				action: 'createVariation',
				message: 'This figure already has a variation with that name.'
			});
		}
		throw redirect(303, `/${params.dance}/figures/${found.figure.id}?v=${made.id}`);
	},

	/**
	 * A variation's one Save: name, directions, positions and timing. An empty
	 * start count, length or end is "same as Basic" and saves as null.
	 *
	 * The name is checked against its siblings FIRST, then the shape is written,
	 * then the name: every refusal comes before any write, so a refused save
	 * leaves nothing half-done.
	 */
	updateVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const form = await request.formData();
		const v = variationOf(found, int(form, 'versionId'));
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = optionalInt(form, 'startCount', 1, 8);
		const lengthCounts = optionalInt(form, 'lengthCounts', 1, MAX_LENGTH_COUNTS);

		if (!name || notes === undefined) {
			return fail(400, {
				action: 'updateVariation',
				message: 'Give the variation a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'updateVariation', message: 'Pick an end position.' });
		}
		if (startCount === undefined || lengthCounts === undefined) {
			return fail(400, {
				action: 'updateVariation',
				message: `A variation starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts — or leaves either as Basic.`
			});
		}
		const db = getDb();
		if (variationNameTaken(db, found.figure.id, name, v.figure.id)) {
			return fail(400, {
				action: 'updateVariation',
				message: 'This figure already has a variation with that name.'
			});
		}
		if (!setFigureShape(db, v.figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		updateVariation(db, v.figure.id, { name, notes });
		return { action: 'updateVariation', ok: true };
	},

	archiveVariation: async ({ params, request }) => {
		const found = figureOf(params);
		const v = variationOf(found, int(await request.formData(), 'versionId'));
		archiveFigure(getDb(), v.figure.id, Date.now());
		throw redirect(303, `/${params.dance}/figures/${found.figure.id}`);
	},

	/** Give the figure its own exercise, so it shows on Today. */
	practise: ({ params }) => {
		const found = figureOf(params);
		if (!addFigureExercise(getDb(), found.figure.id)) {
			return fail(400, {
				action: 'practise',
				message: 'This figure is already practised on its own.'
			});
		}
		return { action: 'practise', ok: true };
	},

	archive: ({ params }) => {
		archiveFigure(getDb(), figureOf(params).figure.id, Date.now());
		throw redirect(303, `/${params.dance}/figures`);
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	deleteRecording: async ({ params, request }) => {
		const form = await request.formData();
		// The recording must belong to the version posted, and that version to
		// this figure — `versionOf` 404s a variation of any other figure.
		const found = versionOf(figureOf(params), int(form, 'versionId'));
		const id = int(form, 'recordingId');
		// Checked against THIS figure's recordings before the delete, not after:
		// `deleteRecording` is a blind delete-and-return, so an id belonging to
		// another figure — and so possibly to the other dance — would already be
		// gone by the time the answer came back.
		if (id === undefined || !found.recordings.some((r) => r.id === id)) {
			return fail(404, {
				action: 'deleteRecording',
				message: 'That recording was already removed.'
			});
		}
		const rec = deleteRecording(getDb(), id);
		if (!rec) {
			return fail(404, {
				action: 'deleteRecording',
				message: 'That recording was already removed.'
			});
		}
		// Row first, then file: a crash between the two leaves an orphan file,
		// which is harmless, rather than a row pointing at nothing.
		await unlink(join(recordingsDir(), rec.file)).catch(() => {});
		return { action: 'deleteRecording', ok: true };
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { figureId: figureOf(params).figure.id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { figureId: figureOf(params).figure.id })
};
