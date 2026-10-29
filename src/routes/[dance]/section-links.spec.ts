/**
 * Section links, through the page actions that make and break them. Every id
 * in a form body is just a number, so each action is checked to refuse one
 * from another lesson, figure or dance — and to leave the links untouched.
 *
 * `getDb()` is mocked for the reason `dance-wall.spec.ts` gives: a spec must
 * never reach `$DATA_DIR`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { spotLinks } from '$lib/server/db/schema';
import {
	addFigureExercise,
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom
} from '$lib/server/figures';
import { archiveExercise, createCustomExercise } from '$lib/server/exercises';
import { addLessonVideo, createLesson, getLesson, linkFigure } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkSpot } from '$lib/server/spot-links';
import * as lessonPage from './lessons/[id]/+page.server';
import * as figurePage from './figures/[id]/+page.server';
import * as exercisePage from './exercises/[id]/+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

function post(dance: string, id: number, fields: Record<string, string>) {
	return {
		params: { dance, id: String(id) },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const call = (action: unknown, event: ReturnType<typeof post>) => (action as Invoke)(event);

type Load = (e: { params: { dance: string; id: string }; url: URL; locals: unknown }) => unknown;
const loadAt = (load: unknown, dance: string, id: number) =>
	(load as Load)({
		params: { dance, id: String(id) },
		url: new URL('http://localhost/'),
		locals: { user: USER }
	}) as Record<string, unknown>;

let db: Db;
let lessonId: number;
let otherLessonId: number;
let figureId: number;
let doble: number;
let drill: number;
let videoId: number;
let section: number;
let otherSection: number;

/** A new figure's one variation, "Basic". */
const salsaFigure = (figureName: string) =>
	createFigure(db, 'salsa', {
		figureName,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;

const links = () => db.select().from(spotLinks).all();

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	figureId = salsaFigure('Enchufla');
	doble = createVariationFrom(db, figureId, 'Doble')!.id;
	drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null }).id;
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
		.lesson.id;
	otherLessonId = createLesson(db, 'salsa', {
		lessonDay: '2026-10-13',
		title: 'Other',
		notes: null
	}).lesson.id;
	videoId = addLessonVideo(db, { lessonId, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 }).id;
	const otherVideo = addLessonVideo(db, {
		lessonId: otherLessonId,
		file: 'o.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(db, { lessonVideoId: videoId }, { startMs: 0, endMs: 900, label: null })!.id;
	otherSection = addSpot(
		db,
		{ lessonVideoId: otherVideo },
		{ startMs: 0, endMs: 900, label: null }
	)!.id;
});

describe('the lesson page', () => {
	it('loads each video’s sections with their links', () => {
		linkSpot(db, section, { figureId: doble });
		const data = loadAt(lessonPage.load, 'salsa', lessonId);
		expect(data.sections).toEqual({
			[videoId]: [
				{
					id: section,
					startMs: 0,
					endMs: 900,
					label: null,
					links: [{ id: expect.any(Number), label: 'Enchufla · Doble', archived: false }]
				}
			]
		});
		// Linking is the popup's, through /api/: the page has no picker of its own.
		expect(data).not.toHaveProperty('sectionTargets');
		expect(lessonPage.actions).not.toHaveProperty('linkSection');
		expect(lessonPage.actions).not.toHaveProperty('unlinkSection');
	});

	it('takes a variation off with its section links when asked', async () => {
		linkFigure(db, lessonId, doble);
		linkSpot(db, section, { figureId: doble });
		await call(
			lessonPage.actions.unlinkFigure,
			post('salsa', lessonId, { figureId: String(doble), alsoSections: '1' })
		);
		expect(links()).toEqual([]);
		expect(getLesson(db, lessonId)!.figures).toEqual([]);
	});

	it('keeps the section links when not asked', async () => {
		linkFigure(db, lessonId, doble);
		linkSpot(db, section, { figureId: doble });
		await call(
			lessonPage.actions.unlinkFigure,
			post('salsa', lessonId, { figureId: String(doble) })
		);
		expect(links()).toHaveLength(1);
	});

	it("takes a drill off with its section links, and leaves another lesson's alone", async () => {
		linkSpot(db, section, { exerciseId: drill });
		linkSpot(db, otherSection, { exerciseId: drill });
		await call(
			lessonPage.actions.unlinkExercise,
			post('salsa', lessonId, { exerciseId: String(drill), alsoSections: '1' })
		);
		expect(links().map((l) => l.spotId)).toEqual([otherSection]);
	});
});

describe('the figure page', () => {
	it('links a section to the variation whose page it is, and unlinks it', async () => {
		await call(figurePage.actions.linkSection, post('salsa', doble, { spotId: String(section) }));
		const [link] = links();
		expect([link.spotId, link.figureId]).toEqual([section, doble]);
		// The same link id on a sibling's page is not the sibling's to remove.
		const res = await call(
			figurePage.actions.unlinkSection,
			post('salsa', figureId, { linkId: String(link.id) })
		);
		expect(res).toMatchObject({ status: 404 });
		await call(figurePage.actions.unlinkSection, post('salsa', doble, { linkId: String(link.id) }));
		expect(links()).toEqual([]);
	});

	it('refuses an archived variation', async () => {
		archiveVariation(db, doble, Date.now());
		await expect(
			call(figurePage.actions.linkSection, post('salsa', doble, { spotId: String(section) }))
		).rejects.toMatchObject({ status: 404 });
		expect(links()).toEqual([]);
	});

	it('refuses a section of the other dance', async () => {
		const bachataLesson = createLesson(db, 'bachata', {
			lessonDay: '2026-10-12',
			title: 'B',
			notes: null
		}).lesson.id;
		const v = addLessonVideo(db, {
			lessonId: bachataLesson,
			file: 'b.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const s = addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: 900, label: null })!.id;
		const res = await call(
			figurePage.actions.linkSection,
			post('salsa', figureId, { spotId: String(s) })
		);
		expect(res).toMatchObject({ status: 400 });
		expect(links()).toEqual([]);
	});

	it('loads the variation’s cards and what it could link', () => {
		linkSpot(db, section, { figureId: doble });
		const data = loadAt(figurePage.load, 'salsa', doble) as {
			variation: { sections: { linkId: number }[] };
			linkable: { video: { src: string } }[];
		};
		expect(data.variation.sections).toHaveLength(1);
		expect(data.linkable.map((g) => g.video.src)).toEqual(['/lesson-videos/o.mp4']);
		// Its sibling has none of them: a variation shows its own sections only.
		const sibling = loadAt(figurePage.load, 'salsa', figureId) as typeof data;
		expect(sibling.variation.sections).toEqual([]);
	});
});

describe('the drill’s exercise page', () => {
	it('links and unlinks its own sections only', async () => {
		await call(exercisePage.actions.linkSection, post('salsa', drill, { spotId: String(section) }));
		const [link] = links();
		expect(link.exerciseId).toBe(drill);
		const other = createCustomExercise(db, 'salsa', { name: 'Shines', everyDays: 3, notes: null });
		const res = await call(
			exercisePage.actions.unlinkSection,
			post('salsa', other.id, { linkId: String(link.id) })
		);
		expect(res).toMatchObject({ status: 404 });
		await call(
			exercisePage.actions.unlinkSection,
			post('salsa', drill, { linkId: String(link.id) })
		);
		expect(links()).toEqual([]);
	});

	it('refuses on a figure’s exercise, which is not a drill', async () => {
		const ex = addFigureExercise(db, figureId)!;
		const res = await call(
			exercisePage.actions.linkSection,
			post('salsa', ex.id, { spotId: String(section) })
		);
		expect(res).toMatchObject({ status: 400 });
		expect(links()).toEqual([]);
	});

	it('loads what a drill could link', () => {
		const data = loadAt(exercisePage.load, 'salsa', drill) as { linkable: unknown[] };
		expect(data.linkable).toHaveLength(2);
	});
});

describe('the figure page, for its recordings’ sections', () => {
	const recordingSection = () => {
		const rec = addRecording(db, {
			figureId,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		return addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: null })!.id;
	};

	it('unlinks a link of its recording’s section to an archived drill — nowhere else can', async () => {
		const link = linkSpot(db, recordingSection(), { exerciseId: drill });
		archiveExercise(db, drill, Date.now());
		await call(figurePage.actions.unlinkSection, post('salsa', figureId, { linkId: String(link) }));
		expect(links()).toEqual([]);
	});

	it('refuses a link that is neither its own nor on its recordings', async () => {
		const link = linkSpot(db, section, { exerciseId: drill });
		const res = await call(
			figurePage.actions.unlinkSection,
			post('salsa', figureId, { linkId: String(link) })
		);
		expect(res).toMatchObject({ status: 404 });
		expect(links()).toHaveLength(1);
	});

	it('loads its recordings’ sections with their links', () => {
		const s = recordingSection();
		linkSpot(db, s, { exerciseId: drill });
		const data = loadAt(figurePage.load, 'salsa', figureId) as {
			variation: { recordingSections: Record<number, { id: number; links: unknown[] }[]> };
		};
		expect(Object.values(data.variation.recordingSections).flat()).toEqual([
			expect.objectContaining({ id: s, links: [expect.objectContaining({ label: 'Clave' })] })
		]);
	});
});
