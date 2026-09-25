import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { logSet } from '$lib/server/exercises';
import {
	archiveFigure,
	deleteRecording,
	getFigure,
	listFigures,
	updateFigure
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { checkbox, int, ints, oneOf, optionalText, text } from '$lib/server/form';
import { buildGraph, figurePositions, MAX_EIGHTS, setFigurePositions } from '$lib/server/graph';
import { getPosition, listPositions } from '$lib/server/positions';
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

export const load: PageServerLoad = ({ params }) => {
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
		maxEights: MAX_EIGHTS,
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, found.figure.id)),
		followsFrom: link(precedes(graph, found.figure.id))
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const figure = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[danceOf(params)].styles);
		const notes = optionalText(form, 'notes');
		const callable = checkbox(form, 'callable');
		const callText = optionalText(form, 'callText', 200);
		if (!name || !partner || !style || notes === undefined || callText === undefined) {
			return fail(400, {
				action: 'update',
				message: 'Give the figure a name (up to 200 characters).'
			});
		}
		const db = getDb();
		if (
			!updateFigure(db, figure.figure.id, {
				name,
				partner,
				style,
				notes,
				callable,
				callText
			})
		) {
			throw error(404, 'Figure not found');
		}
		return { action: 'update', ok: true };
	},

	/** The handholds this figure starts and ends at, plus how long it takes. */
	positions: async ({ params, request }) => {
		const figure = figureOf(params);
		const form = await request.formData();
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const eights = int(form, 'eights');

		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'positions', message: 'Pick an end position.' });
		}
		if (eights === undefined || eights < 1 || eights > MAX_EIGHTS) {
			return fail(400, {
				action: 'positions',
				message: `A figure takes between 1 and ${MAX_EIGHTS} eight-counts.`
			});
		}
		// A posted position id is just a number: `setFigurePositions` rejects one
		// from the other dance, and that is a 404 rather than a message, the same
		// answer every other cross-dance id gets here.
		if (!setFigurePositions(getDb(), figure.figure.id, startIds, endId, eights)) {
			throw error(404, 'Figure not found');
		}
		return { action: 'positions', ok: true };
	},

	archive: ({ params }) => {
		archiveFigure(getDb(), figureOf(params).figure.id, Date.now());
		throw redirect(303, `/${params.dance}/figures`);
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. */
	log: ({ params }) => {
		const found = figureOf(params);
		if (!found.exercise)
			return fail(404, { action: 'log', message: 'No exercise for this figure.' });
		logSet(getDb(), {
			exerciseId: found.exercise.id,
			doneAt: Date.now(),
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		return { action: 'log', ok: true };
	},

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
	}
};
