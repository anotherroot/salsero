/**
 * The hook that runs Keep in step's flow after a save (`flow-hook.ts`):
 * `flowing` wraps a page's actions, `flowAfter` is called by the flat routes.
 * The flow itself is a spy here (its rules are `flow.spec.ts`'s); what is
 * tested is when it runs, on which row, and that it never breaks a response.
 * The second half scans the routes: every save path that can change a copy
 * must keep calling the hook.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({
	db: undefined as unknown,
	calls: [] as unknown[][],
	log: [] as string[],
	throws: false
}));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
vi.mock('$lib/server/clones/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/clones/files')>(
		'$lib/server/clones/files'
	);
	const { NO_FILES } =
		await vi.importActual<typeof import('$lib/server/test-walls')>('$lib/server/test-walls');
	return { ...actual, realCloneFiles: () => NO_FILES };
});
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => 1024 ** 4 };
});
vi.mock('$lib/server/clones/flow', () => ({
	flowFrom: async (...args: unknown[]) => {
		handle.log.push('flow');
		handle.calls.push(args.slice(1, 4));
		if (handle.throws) throw new Error('boom');
		return { landed: [], refused: [] };
	}
}));

import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { openDb, type Db } from '$lib/server/db';
import { lessonVideos, recordings, users, videoSpots } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { U1_SALSA } from '$lib/server/test-walls';
import { stampGene } from './genes';
import { flowAfter, flowing, rootOfRecording, rootOfSpot, rootOfVideo } from './flow-hook';

let db: Db;
let F: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handle.calls = [];
	handle.log = [];
	handle.throws = false;
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' })
		.run();
	F = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	stampGene(db, 'figure', F);
});

/** The event fields `flowing` reads: who acts, and the URL's id. */
const event = (id: number | string = F) => ({
	params: { dance: 'salsa', id: String(id) },
	locals: { user: { id: 'u1' } }
});
type Ev = ReturnType<typeof event>;
const rootOf = (e: Ev) => Number(e.params.id);
/** An action's write, on the row its event names. */
const wrote = (e: Ev) => handle.log.push(`write ${e.params.id}`);

describe('flowing', () => {
	it('flows the page row after a passing action, once its write is done', async () => {
		const actions = flowing('figure', rootOf, {
			save: async (e: Ev) => {
				wrote(e);
				return { action: 'save', ok: true };
			}
		});
		expect(await actions.save(event())).toEqual({ action: 'save', ok: true });
		expect(handle.calls).toEqual([['u1', 'figure', F]]);
		expect(handle.log).toEqual([`write ${F}`, 'flow']);
	});

	it('flows after an action that answers with a redirect, then rethrows it', async () => {
		const actions = flowing('figure', rootOf, {
			create: async (e: Ev) => {
				wrote(e);
				throw redirect(303, '/salsa/figures/99');
			}
		});
		const thrown = await actions.create(event()).catch((e: unknown) => e);
		expect(isRedirect(thrown)).toBe(true);
		expect(handle.calls).toEqual([['u1', 'figure', F]]);
		expect(handle.log).toEqual([`write ${F}`, 'flow']);
	});

	it('never flows after a refusal or an error', async () => {
		const actions = flowing('figure', rootOf, {
			refused: async (e: Ev) => (wrote(e), fail(409, { message: 'clash' })),
			missing: async (e: Ev) => {
				wrote(e);
				throw error(404, 'Not found');
			}
		});
		const refused = await actions.refused(event());
		expect(refused).toMatchObject({ status: 409 });
		await expect(actions.missing(event())).rejects.toMatchObject({ status: 404 });
		expect(handle.calls).toEqual([]);
	});

	it('a sync action is wrapped too', async () => {
		const actions = flowing('figure', rootOf, { tap: (e: Ev) => (wrote(e), { ok: true }) });
		expect(await actions.tap(event())).toEqual({ ok: true });
		expect(handle.calls).toEqual([['u1', 'figure', F]]);
	});

	it('a flow that throws never reaches the response', async () => {
		handle.throws = true;
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		const actions = flowing('figure', rootOf, { save: async (e: Ev) => (wrote(e), { ok: true }) });
		expect(await actions.save(event())).toEqual({ ok: true });
		expect(handle.calls).toHaveLength(1);
		expect(quiet).toHaveBeenCalled();
		quiet.mockRestore();
	});

	it('a root that cannot be read, or a row in no family, runs no flow', async () => {
		const bare = createFigure(db, U1_SALSA, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const actions = flowing(
			'figure',
			(e: Ev) => {
				if (e.params.id === 'x') throw error(404, 'Figure not found');
				return Number(e.params.id);
			},
			{ save: async (e: Ev) => (wrote(e), { ok: true }) }
		);
		expect(await actions.save(event('x'))).toEqual({ ok: true });
		expect(await actions.save(event(bare))).toEqual({ ok: true });
		expect(handle.calls).toEqual([]);
	});
});

describe('flowAfter', () => {
	it('runs the flow for a row in a family, as the actor', async () => {
		await flowAfter('u1', 'figure', F);
		expect(handle.calls).toEqual([['u1', 'figure', F]]);
	});
	it('does nothing without an actor or a row', async () => {
		await flowAfter(undefined, 'figure', F);
		await flowAfter('u1', 'figure', null);
		expect(handle.calls).toEqual([]);
	});
});

describe('roots of the flat routes', () => {
	it('a recording, a lesson video and their spots map to their root', () => {
		const rec = db
			.insert(recordings)
			.values({ figureId: F, file: 'r.mp4', mime: 'video/mp4', kind: 'video', sizeBytes: 1 })
			.returning({ id: recordings.id })
			.get().id;
		const L = createLesson(db, U1_SALSA, { lessonDay: '2026-11-04', title: 'Week 1', notes: null })
			.lesson.id;
		const video = addLessonVideo(db, {
			lessonId: L,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		})!;
		const onRec = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 1000, label: 'A' })!;
		const onVideo = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 0, endMs: null, label: null }
		)!;
		expect(rootOfRecording(db, rec)).toEqual({ kind: 'figure', id: F });
		expect(rootOfVideo(db, video.id)).toEqual({ kind: 'lesson', id: L });
		expect(rootOfSpot(db, onRec.id)).toEqual({ kind: 'figure', id: F });
		expect(rootOfSpot(db, onVideo.id)).toEqual({ kind: 'lesson', id: L });
		expect(rootOfSpot(db, 999)).toBeNull();
		expect(rootOfRecording(db, 999)).toBeNull();
		expect(rootOfVideo(db, 999)).toBeNull();
		// The tables are what the helpers read.
		expect(db.select().from(videoSpots).all()).toHaveLength(2);
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
	});
});

/*
 * Every save path that can change a copy, and how it reaches the flow. A new
 * one goes here; one that stops calling the hook fails. Item pages wrap their
 * actions (`flowing(`); the flat routes and the pages that change a piece of
 * some other row call `flowAfter(` after their write.
 */
const HOOKED: Record<string, 'flowing(' | 'flowAfter('> = {
	// The six item pages of the copyable kinds.
	'src/routes/[dance]/(moves)/figures/[id]/+page.server.ts': 'flowing(',
	'src/routes/[dance]/(moves)/routines/[id]/+page.server.ts': 'flowing(',
	'src/routes/[dance]/(moves)/positions/[id]/+page.server.ts': 'flowing(',
	'src/routes/[dance]/lessons/[id]/+page.server.ts': 'flowing(',
	'src/routes/[dance]/songs/[id]/+page.server.ts': 'flowing(',
	'src/routes/[dance]/(today)/exercises/[id]/+page.server.ts': 'flowing(',
	// Flat routes: sections and points, their links, recordings, lesson videos.
	'src/routes/api/video-spots/+server.ts': 'flowAfter(',
	'src/routes/api/video-spots/[id]/+server.ts': 'flowAfter(',
	'src/routes/api/video-spots/[id]/links/+server.ts': 'flowAfter(',
	'src/routes/api/video-spots/[id]/links/[linkId]/+server.ts': 'flowAfter(',
	'src/routes/api/figures/[id]/recordings/+server.ts': 'flowAfter(',
	'src/routes/api/lessons/[id]/videos/[uploadId]/+server.ts': 'flowAfter(',
	// A saved YouTube video arriving: the link becomes a recording or lesson video.
	'src/routes/api/worker/videos/[id]/file/+server.ts': 'flowAfter(',
	// A group's trash restored: a section, link, recording or video comes back.
	'src/routes/api/trash/[id]/+server.ts': 'flowAfter(',
	'src/routes/[dance]/groups/[id]/deleted/+page.server.ts': 'flowAfter(',
	// A drill's practice settings (its `practice` field), posted on Play.
	'src/routes/[dance]/(today)/exercises/[id]/practice/+server.ts': 'flowAfter(',
	// What uses space: deleting a recording or a lesson video.
	'src/routes/settings/storage/+page.server.ts': 'flowAfter(',
	'src/routes/[dance]/groups/[id]/storage/+page.server.ts': 'flowAfter('
};

describe('every save path on a copy runs the flow', () => {
	for (const [file, call] of Object.entries(HOOKED)) {
		it(`${file} calls ${call}`, () => {
			const text = readFileSync(file, 'utf8');
			expect(text.includes(call), `${file} no longer calls ${call}`).toBe(true);
		});
	}
	it('an item page wraps its whole actions object', () => {
		for (const [file, call] of Object.entries(HOOKED)) {
			if (call !== 'flowing(') continue;
			const text = readFileSync(file, 'utf8');
			expect(text, file).toMatch(/export const actions: Actions = flowing\(/);
		}
	});
});
