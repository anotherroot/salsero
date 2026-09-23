import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { logSet } from '$lib/server/exercises';
import { archiveFigure, deleteRecording, getFigure, updateFigure } from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { checkbox, int, oneOf, optionalText, text } from '$lib/server/form';
import { PARTNER, STYLES } from '$lib/labels';
import type { Actions, PageServerLoad } from './$types';

function figureId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw error(404, 'Figure not found');
	return id;
}

export const load: PageServerLoad = ({ params }) => {
	const found = getFigure(getDb(), figureId(params.id));
	if (!found || found.figure.archivedAt !== null) throw error(404, 'Figure not found');
	return found;
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const form = await request.formData();
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', STYLES);
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
			!updateFigure(db, figureId(params.id), {
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
		archiveFigure(getDb(), figureId(params.id), Date.now());
		throw redirect(303, '/figures');
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. */
	log: ({ params }) => {
		const found = getFigure(getDb(), figureId(params.id));
		if (!found?.exercise)
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
		const id = int(await request.formData(), 'recordingId');
		const db = getDb();
		const rec = id === undefined ? null : deleteRecording(db, id);
		if (!rec || rec.figureId !== figureId(params.id)) {
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
