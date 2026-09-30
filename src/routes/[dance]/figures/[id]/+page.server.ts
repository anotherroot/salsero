import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveFigure,
	deleteRecording,
	getFigure,
	listFigures,
	updateFigure
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { checkbox, int, ints, oneOf, optionalText, text } from '$lib/server/form';
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
import { follows, precedes } from '$lib/graph/graph';
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
 * The figure this URL names, or a 404.
 *
 * `getFigure` is id-scoped, so nothing but this stops `/salsa/figures/7` from
 * rendering a bachata figure — a hole straight through the dance wall, with the
 * URL claiming otherwise. Every action below reaches a row by id too, and each
 * one goes through here first.
 */
function figureOf(params: { dance: string; id: string }) {
	const dance = danceOf(params);
	const found = getFigure(getDb(), figureId(params.id));
	if (!found || found.figure.archivedAt !== null || found.figure.dance !== dance) {
		throw error(404, 'Figure not found');
	}
	return found;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const dance = danceOf(params);
	const found = figureOf(params);
	const db = getDb();
	const graph = buildGraph(db, dance);
	const names = new Map(listFigures(db, dance).map((f) => [f.id, f.name] as [number, string]));
	const link = (ids: number[]) =>
		ids
			.filter((id) => id !== found.figure.id && names.has(id))
			.map((id) => ({ id, name: names.get(id)! }));

	const tags = figurePositions(db, found.figure.id);
	const live = listPositions(db, dance);
	const liveIds = new Set(live.map((p) => p.id));
	// An archived position stays referenced by the figures tagged with it (the
	// routines design doc's rule): if THIS figure points at one, splice it back
	// into the list the pickers render — after the live rows, flagged — so a
	// "Save positions" that touches nothing else does not silently drop it to
	// neutral. `setFigurePositions` already accepts an archived id back; this is
	// what lets the page actually resubmit it unchanged.
	const taggedIds = [...tags.startIds, ...(tags.endId === null ? [] : [tags.endId])];
	const archivedTagged = [...new Set(taggedIds)]
		.filter((id) => !liveIds.has(id))
		.map((id) => getPosition(db, id))
		.filter((p): p is NonNullable<typeof p> => p !== null && p.dance === dance);

	return {
		...found,
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
		// Resolved here so the page never sees a null — the same defaults
		// `buildGraph` applies.
		timing: {
			startCount: found.figure.startCount ?? DEFAULT_START_COUNT,
			lengthCounts: found.figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		},
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, found.figure.id)),
		followsFrom: link(precedes(graph, found.figure.id)),
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
		const callable = checkbox(form, 'callable');
		const callText = optionalText(form, 'callText', 200);
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!name || !partner || !style || notes === undefined || callText === undefined) {
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
		if (!updateFigure(db, found.figure.id, { name, partner, style, notes, callable, callText })) {
			throw error(404, 'Figure not found');
		}
		return { action: 'update', ok: true };
	},

	archive: ({ params }) => {
		archiveFigure(getDb(), figureOf(params).figure.id, Date.now());
		throw redirect(303, `/${params.dance}/figures`);
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	deleteRecording: async ({ params, request }) => {
		const found = figureOf(params);
		const id = int(await request.formData(), 'recordingId');
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
