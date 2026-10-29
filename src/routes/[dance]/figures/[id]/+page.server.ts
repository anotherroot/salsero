import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	addFigureExercise,
	archiveVariation,
	createVariationFrom,
	deleteRecording,
	figureLabels,
	figureNameTaken,
	getFigure,
	getGroup,
	listGroupVariations,
	listMoveTargets,
	moveVariation,
	type MoveResult,
	renameFigure,
	updateVariation,
	variationNameTaken
} from '$lib/server/figures';
import { recordingsDir } from '$lib/server/files';
import { int, ints, oneOf, optionalText, text } from '$lib/server/form';
import { buildGraph, figurePositions, setFigureShape } from '$lib/server/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount,
	MAX_LENGTH_COUNTS
} from '$lib/graph/timing';
import { deleteSetFrom, logSetFrom } from '$lib/server/log-form';
import { getPosition, listPositions, neutralPosition } from '$lib/server/positions';
import { addLinkFrom, deleteLinkFrom, retryVideoFrom, saveVideoFrom } from '$lib/server/link-form';
import { listLinks } from '$lib/server/links';
import { taughtIn } from '$lib/server/lessons';
import { popupData } from '$lib/server/popup';
import { endOf, figureById, follows, precedes, startsOf } from '$lib/graph/graph';
import { PARTNER } from '$lib/labels';
import { DANCES } from '$lib/dances/dances';
import { danceOf } from '$lib/server/scope';
import {
	getSpotLink,
	linkableSections,
	linkSpot,
	sectionsFor,
	SpotLinkedError,
	SpotLinkError,
	unlinkSpot,
	videoOfSpot,
	videoSections
} from '$lib/server/spot-links';
import type { SiblingSummary } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

function variationId(raw: string): number {
	const id = Number(raw);
	if (!Number.isInteger(id)) throw error(404, 'Figure not found');
	return id;
}

function zoneOf(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * The VARIATION this URL names, with its figure, or a 404.
 *
 * `getFigure` is id-scoped, so nothing but this stops `/salsa/figures/7` from
 * rendering a bachata variation — a hole straight through the dance wall. An
 * archived variation, or one whose figure is gone, has no page either: every
 * action goes through here, so none of them can write to one.
 */
function variationOf(params: { dance: string; id: string }) {
	const dance = danceOf(params);
	const db = getDb();
	const found = getFigure(db, variationId(params.id));
	if (
		!found ||
		found.figure.archivedAt !== null ||
		found.figure.dance !== dance ||
		found.figure.groupId === null
	) {
		throw error(404, 'Figure not found');
	}
	const group = getGroup(db, found.figure.groupId);
	if (!group || group.archivedAt !== null || group.dance !== dance) {
		throw error(404, 'Figure not found');
	}
	return { ...found, group };
}

const taken = (figure: string, name: string) =>
	`${figure} already has a variation called ${name}. Rename one first.`;
const figureTaken = (name: string) => `There's already a figure called ${name}.`;

export const load: PageServerLoad = ({ params, url, locals }) => {
	const dance = danceOf(params);

	// An old link — `/figures/<base>?v=<variation>`, from before a variation had
	// a page of its own — lands on the variation. If that id is bad, its page
	// is the 404, which is also where an other-dance or archived one ends up.
	const v = url.searchParams.get('v');
	if (v !== null) {
		const id = variationId(v);
		throw redirect(303, `/${dance}/figures/${id}`);
	}

	const db = getDb();
	const found = variationOf(params);
	const { figure, group } = found;
	const id = figure.id;

	const graph = buildGraph(db, dance);
	const node = figureById(graph, id);
	const labels = figureLabels(db, dance);
	// The graph holds live variations of live figures only, never this one's self.
	const link = (ids: number[]) =>
		ids.filter((other) => other !== id).map((other) => ({ id: other, name: labels.get(other)! }));

	const tags = figurePositions(db, id);
	const live = listPositions(db, dance);
	const liveIds = new Set(live.map((p) => p.id));
	// An archived position stays referenced by the variations tagged with it
	// (the routines design doc's rule): if THIS one points at one, splice it back
	// into the list the pickers render — after the live rows, flagged — so a
	// Save that touches nothing else does not silently drop it.
	// `setFigureShape` accepts an archived id back; this is what lets the page
	// resubmit it.
	const taggedIds = [...tags.startIds, ...(tags.endId === null ? [] : [tags.endId])];
	const archivedTagged = [...new Set(taggedIds)]
		.filter((p) => !liveIds.has(p))
		.map((p) => getPosition(db, p))
		.filter((p): p is NonNullable<typeof p> => p !== null && p.dance === dance);

	const shape = {
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	};

	// Every live variation of the figure, this one included, as its sheet lists
	// them: what each starts and ends on, neutral named, and its timing.
	const positionName = new Map(
		[...live, ...archivedTagged].map((p) => [p.id, p.name] as [number, string])
	);
	const neutralName = neutralPosition(db, dance)?.name ?? 'the neutral hold';
	const nameOf = (p: number) => {
		if (p === graph.neutral) return neutralName;
		if (!positionName.has(p)) positionName.set(p, getPosition(db, p)?.name ?? 'a removed hold');
		return positionName.get(p)!;
	};
	const siblings: SiblingSummary[] = listGroupVariations(db, group.id).map((s) => {
		const n = figureById(graph, s.id);
		const starts = n ? [...startsOf(graph, n)].sort((a, b) => a - b) : [graph.neutral];
		const end = n ? endOf(graph, n) : graph.neutral;
		return {
			id: s.id,
			name: s.name,
			holds: `${starts.map(nameOf).join(' / ')} → ${nameOf(end)}`,
			timing: `Starts on ${n?.start ?? DEFAULT_START_COUNT} · ${n?.length ?? DEFAULT_LENGTH_COUNTS} counts`,
			videos: s.id === id ? found.recordings.length : (getFigure(db, s.id)?.recordings.length ?? 0)
		};
	});

	return {
		figure: { id: group.id, name: group.name },
		variation: {
			id,
			name: figure.name,
			partner: figure.partner,
			styleTag: figure.styleTag,
			notes: figure.notes,
			recordings: found.recordings,
			sections: sectionsFor(db, { figureId: id }),
			// Each recording's own sections and what they link to, so a link can be
			// undone even when its target is archived and has no page.
			recordingSections: Object.fromEntries(
				found.recordings.map((r) => [r.id, videoSections(db, { recordingId: r.id })])
			)
		},
		siblings,
		exercise: found.exercise,
		popup: found.exercise
			? popupData(db, dance, found.exercise.id, zoneOf(locals), Date.now())
			: null,
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
		// What the edit form shows.
		shape,
		// What is actually danced, with neutral resolved.
		effective: {
			starts: node ? startsOf(graph, node) : [],
			end: node ? endOf(graph, node) : null,
			startCount: node?.start ?? shape.startCount,
			lengthCounts: node?.length ?? shape.lengthCounts
		},
		// Derived per request, never stored — the same rule urgency follows.
		leadsTo: link(follows(graph, id)),
		followsFrom: link(precedes(graph, id)),
		links: listLinks(db, { figureId: id }),
		taughtIn: taughtIn(db, id),
		linkable: linkableSections(db, { figureId: id }),
		moveTargets: listMoveTargets(db, dance, group.id)
	};
};

export const actions: Actions = {
	/**
	 * The page's one Save: the figure's name, the variation's details, its
	 * positions and its timing together.
	 *
	 * Every refusal comes before any write. The names are checked first; then
	 * `setFigureShape` runs, because it is the half that can still refuse — a
	 * position of another dance — and only then the details and the figure's
	 * name. A refused save leaves nothing half-done.
	 */
	update: async ({ params, request }) => {
		const found = variationOf(params);
		const form = await request.formData();
		const figureName = text(form, 'figureName');
		const name = text(form, 'name');
		const partner = oneOf(form, 'partner', PARTNER);
		const style = oneOf(form, 'style', DANCES[danceOf(params)].styles);
		const notes = optionalText(form, 'notes');
		const startIds = ints(form, 'startIds');
		const rawEnd = String(form.get('endId') ?? '');
		const endId = rawEnd === '' ? null : Number(rawEnd);
		const startCount = int(form, 'startCount');
		const lengthCounts = int(form, 'lengthCounts');

		if (!figureName || !name || !partner || !style || notes === undefined) {
			return fail(400, {
				action: 'update',
				message: 'Give the figure and the variation a name (up to 200 characters).'
			});
		}
		if (endId !== null && !Number.isInteger(endId)) {
			return fail(400, { action: 'update', message: 'Pick an end position.' });
		}
		if (!isStartCount(startCount) || !isLengthCounts(lengthCounts)) {
			return fail(400, {
				action: 'update',
				message: `A variation starts on a count from 1 to 8 and takes 1 to ${MAX_LENGTH_COUNTS} counts.`
			});
		}

		const db = getDb();
		const { figure, group } = found;
		const dance = danceOf(params);
		if (figureNameTaken(db, dance, figureName, group.id)) {
			return fail(400, { action: 'update', message: figureTaken(figureName) });
		}
		if (variationNameTaken(db, group.id, name, figure.id)) {
			return fail(400, { action: 'update', message: taken(group.name, name) });
		}
		// A posted position id is just a number: `setFigureShape` rejects one from
		// the other dance, and that is a 404 rather than a message, the same answer
		// every other cross-dance id gets here.
		if (!setFigureShape(db, figure.id, { startIds, endId, startCount, lengthCounts })) {
			throw error(404, 'Figure not found');
		}
		if (!updateVariation(db, figure.id, { name, partner, style, notes })) {
			throw error(404, 'Figure not found');
		}
		// A case-only change ("enchufla") is a change: the figure keeps its place,
		// `figureNameTaken` skipped it above, and the new spelling is saved.
		if (figureName !== group.name.trim() && !renameFigure(db, group.id, figureName)) {
			return fail(400, { action: 'update', message: figureTaken(figureName) });
		}
		return { action: 'update', ok: true };
	},

	/** "+ New variation": a copy of this one under a new name, opened. */
	createVariation: async ({ params, request }) => {
		const { figure, group } = variationOf(params);
		const name = text(await request.formData(), 'name');
		if (!name) {
			return fail(400, {
				action: 'createVariation',
				message: 'Give the variation a name (up to 200 characters).'
			});
		}
		const made = createVariationFrom(getDb(), figure.id, name);
		if (!made) {
			return fail(400, { action: 'createVariation', message: taken(group.name, name) });
		}
		throw redirect(303, `/${params.dance}/figures/${made.id}`);
	},

	/**
	 * "Move <variation> to…": into another figure of the dance (`target` is its
	 * id, `name` what to call it there), or into a new one of its own
	 * (`target=new`, named by `figureName`). The URL stays the same — the
	 * variation keeps its id.
	 */
	move: async ({ params, request }) => {
		const { figure, group } = variationOf(params);
		const form = await request.formData();
		const rawTarget = String(form.get('target') ?? '');
		const db = getDb();

		let result: MoveResult;
		let figureName: string | undefined;
		let groupId: number | undefined;
		// Blank means "keep its name", the same as not posting one.
		const name = text(form, 'name');
		if (rawTarget === 'new') {
			figureName = text(form, 'figureName');
			if (!figureName) {
				return fail(400, {
					action: 'move',
					message: 'Give the new figure a name (up to 200 characters).'
				});
			}
			result = moveVariation(db, figure.id, { newFigure: figureName });
		} else {
			groupId = int(form, 'target');
			if (groupId === undefined) {
				return fail(400, { action: 'move', message: 'Pick where to move it.' });
			}
			result = moveVariation(db, figure.id, { groupId, name });
		}

		if (!result.ok) {
			switch (result.reason) {
				// The variation went in the meantime, or the target is not a live
				// figure of this dance — a posted id is just a number.
				case 'gone':
					throw error(404, 'Figure not found');
				case 'same-figure':
					return fail(400, {
						action: 'move',
						message: `${figure.name} is already a variation of ${group.name}.`
					});
				case 'name-taken': {
					const target = groupId === undefined ? null : getGroup(db, groupId);
					return fail(400, {
						action: 'move',
						message: taken(target?.name ?? 'That figure', name ?? figure.name),
						name: String(form.get('name') ?? '')
					});
				}
				case 'figure-name-taken':
					return fail(400, { action: 'move', message: figureTaken(figureName ?? '') });
			}
		}
		throw redirect(303, `/${params.dance}/figures/${figure.id}`);
	},

	/**
	 * Archive this variation. The page lands on the figure's first variation
	 * left, or on the figures list when this was the last and the figure went
	 * with it.
	 */
	archive: ({ params }) => {
		const { figure, group } = variationOf(params);
		const db = getDb();
		const done = archiveVariation(db, figure.id, Date.now());
		if (!done) throw error(404, 'Figure not found');
		const [first] = done.figureRemoved ? [] : listGroupVariations(db, group.id);
		throw redirect(
			303,
			first ? `/${params.dance}/figures/${first.id}` : `/${params.dance}/figures`
		);
	},

	/** Give this variation its own exercise, so it shows on Today. */
	practise: ({ params }) => {
		const { figure } = variationOf(params);
		if (!addFigureExercise(getDb(), figure.id)) {
			return fail(400, {
				action: 'practise',
				message: 'This variation is already practised on its own.'
			});
		}
		return { action: 'practise', ok: true };
	},

	/** Quick log from the figure page, so practising after watching a recording is one tap. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	deleteRecording: async ({ params, request }) => {
		const found = variationOf(params);
		const id = int(await request.formData(), 'recordingId');
		// Checked against THIS variation's recordings before the delete, not
		// after: `deleteRecording` is a blind delete-and-return, so an id
		// belonging to another variation — and so possibly to the other dance —
		// would already be gone by the time the answer came back.
		if (id === undefined || !found.recordings.some((r) => r.id === id)) {
			return fail(404, {
				action: 'deleteRecording',
				message: 'That recording was already removed.'
			});
		}
		let rec;
		try {
			rec = deleteRecording(getDb(), id);
		} catch (e) {
			if (e instanceof SpotLinkedError) {
				return fail(409, { action: 'deleteRecording', recordingId: id, message: e.message });
			}
			throw e;
		}
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

	/** A section for this variation. `linkSpot` refuses one from the other dance. */
	linkSection: async ({ params, request }) => {
		const { figure } = variationOf(params);
		const spotId = int(await request.formData(), 'spotId');
		if (spotId === undefined) {
			return fail(400, { action: 'linkSection', message: 'Pick a section.' });
		}
		try {
			linkSpot(getDb(), spotId, { figureId: figure.id });
		} catch (e) {
			if (e instanceof SpotLinkError) {
				return fail(e.status, { action: 'linkSection', message: e.message });
			}
			throw e;
		}
		return { action: 'linkSection', ok: true };
	},

	unlinkSection: async ({ params, request }) => {
		const found = variationOf(params);
		const id = int(await request.formData(), 'linkId');
		const link = id === undefined ? null : getSpotLink(getDb(), id);
		// This variation's own link, or any link of a section on one of its
		// recordings — the only place left to unlink one whose target is archived.
		const video = link ? videoOfSpot(getDb(), link.spotId) : null;
		const ownTarget =
			link !== null && 'figureId' in link.target && link.target.figureId === found.figure.id;
		const onOwnRecording =
			video !== null &&
			'recordingId' in video.owner &&
			found.recordings.some(
				(r) => 'recordingId' in video.owner && r.id === video.owner.recordingId
			);
		if (!link || !(ownTarget || onOwnRecording) || !unlinkSpot(getDb(), link.id, link.target)) {
			return fail(404, { action: 'unlinkSection', message: 'That link was already removed.' });
		}
		return { action: 'unlinkSection', ok: true };
	},

	addLink: async ({ params, request }) =>
		addLinkFrom(request, getDb(), { figureId: variationOf(params).figure.id }),
	deleteLink: async ({ params, request }) =>
		deleteLinkFrom(request, getDb(), { figureId: variationOf(params).figure.id }),
	saveVideo: async ({ params, request }) =>
		saveVideoFrom(request, getDb(), { figureId: variationOf(params).figure.id }),
	retryVideo: async ({ params, request }) =>
		retryVideoFrom(request, getDb(), { figureId: variationOf(params).figure.id })
};
