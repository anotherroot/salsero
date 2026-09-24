import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { logSet } from '$lib/server/exercises';
import { archiveFigure, deleteRecording, getFigure, updateFigure } from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { checkbox, int, oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER } from '$lib/labels';
import { DANCES, type DanceSlug } from '$lib/dances/dances';
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
	const found = getFigure(getDb(), figureId(params.id));
	if (!found || found.figure.archivedAt !== null || found.figure.dance !== params.dance) {
		throw error(404, 'Figure not found');
	}
	return found;
}

export const load: PageServerLoad = ({ params }) => figureOf(params);

export const actions: Actions = {
	update: async ({ params, request }) => {
		const figure = figureOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[params.dance as DanceSlug].styles);
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
