/**
 * Leaving, being removed, a deleted group, through the routes: a former
 * member keeps copies of what they had (Keep everything (mode=all), as the leave
 * sheet offers the choice), theirs to edit, and reads nothing of the group:
 * its lesson, figure and routine pages, its media files, the player, Moves'
 * and Routines' group sections, the Lessons tab, Today's lesson days and
 * what's new. Someone who left before Keep, with their adds still there,
 * reads nothing either (the boot pass settles them). A member of a deleted
 * group keeps their added lesson until the purge (ruling 4), and its lessons
 * say when it goes; once purged, Today's past days name the kept copies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The media servers read $DATA_DIR: a temporary one, never the real one.
const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

// The routes' files are a fake: a route spec never reaches $DATA_DIR.
vi.mock('$lib/server/clones/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/clones/files')>(
		'$lib/server/clones/files'
	);
	return {
		...actual,
		realCloneFiles: () => ({
			link: async (_kind: string, file: string) => `copy-${file}`,
			unlink: async () => {}
		})
	};
});

import type { Cookies } from '@sveltejs/kit';
import { openDb, type Db } from '$lib/server/db';
import { and, eq, isNull } from 'drizzle-orm';
import {
	exercises,
	figures,
	lessons,
	routines,
	sets,
	teamMembers,
	users
} from '$lib/server/db/schema';
import { crossRefs } from '$lib/server/integrity';
import { createTeam, deleteTeam, joinTeam } from '$lib/server/teams';
import {
	addLessonVideo,
	createLesson,
	lessonDays,
	linkExercise,
	linkRoutine,
	publishLesson
} from '$lib/server/lessons';
import { createCustomExercise } from '$lib/server/exercises';
import { addRecording, createFigure } from '$lib/server/figures';
import { addFigureSlot, createRoutine } from '$lib/server/routines';
import { shareSong } from '$lib/server/song-share';
import { readyGroupSong } from '$lib/server/test-class';
import { addLesson, entryFor } from '$lib/server/entries';
import { whatsNew } from '$lib/server/whats-new';
import { purgeTeams } from '$lib/server/team-purge';
import { pastGroups } from '$lib/exercises/today';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { actions as groupActions, load as groupLoad } from './[id]/+page.server';
import { actions as peopleActions } from './[id]/people/+page.server';
import { load as lessonLoad } from '../lessons/[id]/+page.server';
import { load as lessonsLoad } from '../lessons/+layout.server';
import { load as figureLoad } from '../(moves)/figures/[id]/+page.server';
import { load as layoutLoad } from '../(moves)/+layout.server';
import { figuresView, type FiguresLists } from '$lib/moves/filter';

/** The Figures and Routines lists are the layout's; Figures through the pure view. */
const figuresLoad = (e: never) => {
	const l = (layoutLoad as unknown as (e: unknown) => { lists: { figures: FiguresLists } })({
		...(e as object),
		depends: () => {}
	}).lists.figures;
	return { ...l, ...figuresView(l, { q: '' }) };
};
import { load as routineLoad } from '../(moves)/routines/[id]/+page.server';
const routinesLoad = (e: never) =>
	(layoutLoad as unknown as (e: unknown) => { lists: { routines: never } })({
		...(e as object),
		depends: () => {}
	}).lists.routines;
import { load as playerLoad } from '../player/+page.server';
import { load as todayLoad } from '../(today)/+page.server';
import { GET as getRecording } from '../../recordings/[file]/+server';
import { GET as getLessonVideo } from '../../lesson-videos/[file]/+server';
import { GET as getAudio } from '../../audio/[file]/+server';

const REC_FILE = '00000000-0000-4000-8000-0000000000a1.mp4';
const VIDEO_FILE = '00000000-0000-4000-8000-0000000000a2.mp4';
const SONG_FILE = '00000000-0000-4000-8000-0000000000a3.mp3';

let db: Db;
let lesson: number;
let draft: number;
let drill: number;
let variation: number;
let routine: number;

const DAY = 24 * 60 * 60 * 1000;
const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC', dance: 'salsa' });
/** No group mode: the cookie is never set. */
const cookies = { get: () => undefined, delete: () => {}, set: () => {} } as unknown as Cookies;
const ev = (uid: string, params: Record<string, string>, extra: Record<string, unknown> = {}) =>
	({
		params: { dance: 'salsa', ...params },
		locals: { user: user(uid) },
		url: new URL('http://localhost/salsa'),
		cookies,
		...extra
	}) as never;
const post = (fields: Record<string, string>) =>
	new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		const status = (e as { status?: number }).status;
		if (typeof status !== 'number') throw e;
		return { status };
	}
}
type LessonData = {
	canEdit: boolean;
	notice: { tone: string; text: string; action: string } | null;
};
const lessonPage = async (uid: string, id: number) =>
	run(() => lessonLoad(ev(uid, { id: String(id) })) as LessonData);

/** What a handler answered: its status, or the one it threw. */
async function status(fn: () => unknown): Promise<number> {
	const r = await run(fn);
	return r.status ?? (r.value as Response | undefined)?.status ?? 200;
}
const media = (get: unknown, file: string, uid: string) =>
	status(() =>
		(get as (e: unknown) => unknown)({
			params: { file },
			locals: { user: user(uid) },
			request: new Request('http://localhost/')
		})
	);

/**
 * Everything of the group a person might read, as one answer: each page's
 * status, and which group things each list shows.
 */
async function whatOf(uid: string) {
	const figuresPage = (await figuresLoad(ev(uid, {}))) as {
		groups: { team: { id: number } }[];
	};
	const routinesPage = (await routinesLoad(ev(uid, {}))) as {
		groups: { team: { id: number } }[];
	};
	const lessonsTab = (await lessonsLoad(ev(uid, {}))) as {
		lessons: { id: number; team?: { id: number } }[];
	};
	return {
		lesson: (await lessonPage(uid, lesson)).status ?? 200,
		figure: await status(() => figureLoad(ev(uid, { id: String(variation) }))),
		routine: await status(() => routineLoad(ev(uid, { id: String(routine) }))),
		player: await status(() =>
			playerLoad(ev(uid, {}, { url: new URL(`http://localhost/salsa/player?routine=${routine}`) }))
		),
		recording: await media(getRecording, REC_FILE, uid),
		lessonVideo: await media(getLessonVideo, VIDEO_FILE, uid),
		audio: await media(getAudio, SONG_FILE, uid),
		moves: figuresPage.groups.map((g) => g.team.id),
		routines: routinesPage.groups.map((g) => g.team.id),
		lessonsTab: lessonsTab.lessons.filter((l) => l.team).map((l) => l.id),
		// The group's lessons only: a person's own copy is theirs.
		lessonDays: Object.keys(lessonDays(db, { userId: uid, dance: 'salsa' }))
			.map(Number)
			.filter((id) => id === lesson || id === draft),
		whatsNew: [...whatsNew(db, uid, 'salsa').byTeam.keys()]
	};
}

const READS_ALL = () => ({
	lesson: 200,
	figure: 200,
	routine: 200,
	player: 200,
	recording: 200,
	lessonVideo: 200,
	audio: 200,
	moves: [1],
	routines: [1],
	lessonsTab: [lesson],
	lessonDays: [lesson],
	whatsNew: [1]
});

const NOTHING = {
	lesson: 404,
	figure: 404,
	routine: 404,
	player: 404,
	recording: 404,
	lessonVideo: 404,
	audio: 404,
	moves: [],
	routines: [],
	lessonsTab: [],
	lessonDays: [],
	whatsNew: []
};

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-leaving-'));
	for (const [dir, file] of [
		['recordings', REC_FILE],
		['lesson-videos', VIDEO_FILE],
		['audio', SONG_FILE]
	]) {
		await mkdir(join(envMock.DATA_DIR, dir), { recursive: true });
		await writeFile(join(envMock.DATA_DIR, dir, file), Buffer.alloc(10, 1));
	}
	db = openDb(':memory:');
	handle.db = db;
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tue 3 Nov', notes: null })
		.lesson.id;
	draft = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Draft', notes: null })
		.lesson.id;
	drill = createCustomExercise(db, T1_SALSA, { name: 'Drill', everyDays: 3, notes: null }).id;
	linkExercise(db, lesson, drill, 'u1');
	variation = createFigure(db, T1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	addRecording(
		db,
		{
			figureId: variation,
			file: REC_FILE,
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		},
		'u1'
	);
	routine = createRoutine(db, T1_SALSA, { name: 'Rueda', notes: null }).routine.id;
	if (addFigureSlot(db, routine, variation, 'u1') === null) throw new Error('slot refused');
	if (!linkRoutine(db, lesson, routine, 'u1')) throw new Error('link refused');
	addLessonVideo(
		db,
		{ lessonId: lesson, file: VIDEO_FILE, mime: 'video/mp4', sizeBytes: 10 },
		'u1'
	);
	const song = readyGroupSong(db, T1_SALSA, 'Chan Chan', SONG_FILE);
	if (!shareSong(db, T1_SALSA, song, 3)) throw new Error('share refused');
	publishLesson(db, T1_SALSA, lesson, 3);
	for (const u of ['u2', 'u3']) {
		addLesson(
			db,
			u,
			lesson,
			{ lesson: true, routineIds: [routine], drillIds: [drill], figureIds: [] },
			4
		);
	}
});

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

describe('a member of a live group', () => {
	it('reads all of it: the pages, the files, the player, and the lists', async () => {
		expect(await whatOf('u2')).toEqual(READS_ALL());
	});

	it('has no banner on its lesson', async () => {
		const page = await lessonPage('u2', lesson);
		expect(page.value).toMatchObject({ canEdit: false, notice: null });
	});
});

/** u's own lessons: what Keep gave them. */
const ownLessons = (uid: string) =>
	db
		.select()
		.from(lessons)
		.where(and(eq(lessons.userId, uid), isNull(lessons.teamId)))
		.all();

/** u's own copies, as the lists show them: what took the group's place. */
async function copiesOf(uid: string) {
	const figuresPage = (await figuresLoad(ev(uid, {}))) as {
		figures: { figures: { id: number }[] }[];
	};
	const routinesPage = (await routinesLoad(ev(uid, {}))) as { routines: { id: number }[] };
	const lessonsTab = (await lessonsLoad(ev(uid, {}))) as {
		lessons: { id: number; team?: unknown }[];
	};
	return {
		moves: figuresPage.figures.flatMap((m) => m.figures.map((f) => f.id)),
		routines: routinesPage.routines.map((r) => r.id),
		lessonsTab: lessonsTab.lessons.filter((l) => !l.team).map((l) => l.id),
		lessonDays: Object.keys(lessonDays(db, U2_SALSA)).map(Number)
	};
}

describe('after leaving', () => {
	beforeEach(async () => {
		const left = await run(() =>
			groupActions.leave!(ev('u2', { id: '1' }, { request: post({ mode: 'all' }) }))
		);
		expect(left.status).toBe(303);
	});

	it('they read nothing of the group: every page, file and list', async () => {
		expect(await whatOf('u2')).toEqual(NOTHING);
		// Not hollow: someone still in the group reads all of it.
		expect(await whatOf('u3')).toEqual(READS_ALL());
	});

	it('their own copies are in the lists instead', async () => {
		const [copy] = ownLessons('u2');
		const own = <T extends typeof figures | typeof routines>(t: T) =>
			db
				.select({ id: t.id })
				.from(t)
				.where(eq(t.userId, 'u2'))
				.all()
				.map((r) => r.id);
		expect(await copiesOf('u2')).toEqual({
			moves: own(figures),
			routines: own(routines),
			lessonsTab: [copy.id],
			lessonDays: [copy.id]
		});
		expect(own(figures)).toHaveLength(1);
		expect(own(routines)).toHaveLength(1);
	});

	it('they keep a copy of the added lesson, theirs to edit; the group’s is gone for them', async () => {
		const [copy] = ownLessons('u2');
		expect(copy.title).toBe('Tue 3 Nov');
		expect((await lessonPage('u2', copy.id)).value).toMatchObject({ canEdit: true, notice: null });
		expect((await lessonPage('u2', lesson)).status).toBe(404);
	});

	it('the group page is gone, and a lesson they had not added is too', async () => {
		expect((await run(() => groupLoad(ev('u2', { id: '1' })))).status).toBe(404);
		expect((await lessonPage('u2', draft)).status).toBe(404);
	});

	it('their practice stays on Today, on the copies; nothing is left on the group’s rows', () => {
		const live = db
			.select()
			.from(exercises)
			.where(and(eq(exercises.userId, 'u2'), isNull(exercises.archivedAt)))
			.all();
		expect(live.some((x) => x.lessonId === lesson)).toBe(false);
		expect(live.some((x) => x.lessonId === ownLessons('u2')[0].id)).toBe(true);
		expect(live.some((x) => x.drillId === drill)).toBe(false);
		expect(live.some((x) => x.routineId === routine)).toBe(false);
		expect(live.some((x) => x.source === 'custom' && x.name === 'Drill' && x.teamId === null)).toBe(
			true
		);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('after being removed', () => {
	it('is the same as leaving with everything kept: nothing of the group, the copies instead', async () => {
		const removed = await run(() =>
			peopleActions.remove!(ev('u1', { id: '1' }, { request: post({ userId: 'u3' }) }))
		);
		expect(removed.value).toMatchObject({ ok: true });
		const [copy] = ownLessons('u3');
		expect((await lessonPage('u3', copy.id)).value).toMatchObject({ canEdit: true });
		expect(await whatOf('u3')).toEqual(NOTHING);
		expect((await run(() => groupLoad(ev('u3', { id: '1' })))).status).toBe(404);
		// Nothing of u3's practice is left live on the group's drill.
		const onGroup = entryFor(db, 'u3', { drillId: drill });
		expect(!onGroup || onGroup.archivedAt !== null).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('when Keep fails', () => {
	/** Every write fails: Keep's transaction throws before anything changes. */
	function failWrites() {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(db, 'transaction').mockImplementation((() => {
			throw new Error('disk I/O error');
		}) as Db['transaction']);
	}

	it('leaving says so, and the leaver is still in the group', async () => {
		failWrites();
		const left = await run(() =>
			groupActions.leave!(ev('u2', { id: '1' }, { request: post({ mode: 'all' }) }))
		);
		vi.restoreAllMocks();
		expect(left.value).toMatchObject({
			status: 500,
			data: { action: 'leave', message: 'Could not keep your copies. Try again.' }
		});
		expect(db.select().from(teamMembers).where(eq(teamMembers.userId, 'u2')).all()).toHaveLength(1);
	});

	it('removing says so, and the person is still in the group', async () => {
		failWrites();
		const removed = await run(() =>
			peopleActions.remove!(ev('u1', { id: '1' }, { request: post({ userId: 'u3' }) }))
		);
		vi.restoreAllMocks();
		expect(removed.value).toMatchObject({
			status: 500,
			data: { action: 'remove', message: 'Could not keep their copies. Try again.' }
		});
		expect(db.select().from(teamMembers).where(eq(teamMembers.userId, 'u3')).all()).toHaveLength(1);
	});
});

/** Out of the group the way people left before Keep: the row goes, the add stays. */
const leftBeforeKeep = (uid: string) =>
	db
		.delete(teamMembers)
		.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, uid)))
		.run();

describe('someone who left before Keep, not yet settled', () => {
	it('reads nothing of the group, their added lesson included', async () => {
		leftBeforeKeep('u2');
		expect(await whatOf('u2')).toEqual(NOTHING);
	});
});

describe('a deleted group', () => {
	// Tue 3 Nov, in the evening: it goes for good 30 days on, on 3 Dec.
	const T = Date.UTC(2026, 10, 3, 20);

	it('tells its members, and its owner, the day it goes', async () => {
		deleteTeam(db, 1, 'u1', T);
		for (const uid of ['u2', 'u1']) {
			expect((await lessonPage(uid, lesson)).value).toMatchObject({
				canEdit: false,
				notice: { tone: 'warning', text: 'Salsa nadaljevalna is being deleted on 3 Dec' }
			});
		}
	});

	it('a member keeps their added lesson until the purge; its songs and what’s new go (ruling 4)', async () => {
		deleteTeam(db, 1, 'u1', T);
		expect(await whatOf('u2')).toEqual({ ...READS_ALL(), audio: 404, whatsNew: [] });
	});

	it('someone who had left before it was deleted reads nothing of it', async () => {
		leftBeforeKeep('u2');
		deleteTeam(db, 1, 'u1', T);
		expect(await whatOf('u2')).toEqual(NOTHING);
	});

	it('once purged, Today’s past day names what was logged: the copies the purge kept', async () => {
		const entry = entryFor(db, 'u2', { lessonId: lesson })!.id;
		const drillEntry = entryFor(db, 'u2', { drillId: drill })!.id;
		db.insert(sets)
			.values({ exerciseId: entry, doneAt: Date.UTC(2026, 10, 3, 12) })
			.run();
		db.insert(sets)
			.values({ exerciseId: drillEntry, doneAt: Date.UTC(2026, 10, 3, 13) })
			.run();
		deleteTeam(db, 1, 'u1', T);
		expect(
			await purgeTeams(db, T + 31 * DAY, {
				lessonVideos: '/nowhere',
				recordings: '/nowhere',
				audio: '/nowhere'
			})
		).toBe(1);
		expect(await whatOf('u2')).toEqual(NOTHING);

		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(T + 31 * DAY);
		const today = (await todayLoad(
			ev('u2', {}, { url: new URL('http://localhost/salsa?day=2026-11-03') })
		)) as { past: { daySets: Parameters<typeof pastGroups>[0] } };
		expect(pastGroups(today.past.daySets).map((g) => g.name)).toEqual([
			'Review: Tue 3 Nov',
			'Drill'
		]);
	});
});
