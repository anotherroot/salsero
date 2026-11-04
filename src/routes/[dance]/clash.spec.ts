/**
 * The clash check on every save path it covers: a save carries what its
 * editor saw, and one that saw something else since is refused with the other
 * version, writing nothing. The same rules run on a group's rows and on a
 * person's own (the spec's "own things too"); only a missing `seen` differs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import {
	exercises,
	figures,
	lessons,
	routines,
	routineSteps,
	users,
	videoSpots
} from '$lib/server/db/schema';
import { createTeam } from '$lib/server/teams';
import { createLesson, archiveLesson, addLessonVideo } from '$lib/server/lessons';
import { createFigure } from '$lib/server/figures';
import { addFigureSlot, archiveRoutine, createRoutine } from '$lib/server/routines';
import { createCustomExercise } from '$lib/server/exercises';
import { addSpot } from '$lib/server/spots';
import { seedPositions } from '$lib/server/test-positions';
import type { Space } from '$lib/server/scope';
import * as lessonPage from './lessons/[id]/+page.server';
import * as figurePage from './figures/[id]/+page.server';
import * as routinePage from './routines/[id]/+page.server';
import * as exercisePage from './exercises/[id]/+page.server';
import * as spotEndpoint from '../api/video-spots/[id]/+server';

let db: Db;
const U1 = { id: 'u1', email: 'u1@x.si', timezone: 'UTC', isAdmin: false };

function post(fields: Record<string, string | string[]>, id: number) {
	const body = new URLSearchParams();
	for (const [k, v] of Object.entries(fields)) {
		for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
	}
	return {
		params: { dance: 'salsa', id: String(id) },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body
		}),
		locals: { user: U1 },
		url: new URL('http://localhost/')
	};
}
type Invoke = (event: ReturnType<typeof post>) => unknown;
const call = async (action: unknown, event: ReturnType<typeof post>) =>
	(await (action as Invoke)(event)) as {
		status?: number;
		data?: Record<string, unknown>;
		ok?: boolean;
		fingerprint?: string;
	};
const load = (page: { load: unknown }, id: number) =>
	(page.load as Invoke)(post({}, id)) as Record<string, unknown>;

const seenOf = (data: Record<string, unknown>) => JSON.stringify(data.seen);

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	seedPositions(db);
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana', lastName: 'K' })
		.run();
});

function team(): Space {
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok) throw new Error('team expected');
	return { dance: 'salsa', teamId: made.teamId, actorId: 'u1' };
}
const own = (): Space => ({ dance: 'salsa', userId: 'u1' });

describe.each([
	['a group lesson', team, true],
	['a personal lesson', own, false]
] as const)('%s', (_, space, isTeam) => {
	let id: number;
	const fields = { title: 'Rueda', lessonDay: '2026-11-01', notes: 'mine' };
	const notes = () => db.select().from(lessons).where(eq(lessons.id, id)).get()!.notes;

	beforeEach(() => {
		id = createLesson(db, space(), { lessonDay: '2026-11-01', title: 'Rueda', notes: 'first' })
			.lesson.id;
	});

	it('refuses a notes save that saw older notes, keeping the other save', async () => {
		const seen = seenOf(load(lessonPage, id));
		// The other device saves first.
		const other = await call(
			lessonPage.actions.update,
			post({ ...fields, notes: 'theirs', seen }, id)
		);
		expect(other.ok).toBe(true);
		const r = await call(lessonPage.actions.update, post({ ...fields, seen }, id));
		expect(r.status).toBe(409);
		expect(r.data?.clash).toMatchObject({
			changed: ['notes'],
			current: { notes: 'theirs' },
			// In a group, History names who saved (here the same person, on another device).
			by: isTeam ? 'Ana' : null
		});
		expect((r.data?.clash as { at: number | null }).at === null).toBe(!isTeam);
		expect(notes()).toBe('theirs');
	});

	it('saves with a fresh seen', async () => {
		const seen = seenOf(load(lessonPage, id));
		expect((await call(lessonPage.actions.update, post({ ...fields, seen }, id))).ok).toBe(true);
		expect(notes()).toBe('mine');
	});

	it('says gone on a lesson archived since', async () => {
		const seen = seenOf(load(lessonPage, id));
		archiveLesson(db, id, 5, 'u1');
		const r = await call(lessonPage.actions.update, post({ ...fields, seen }, id));
		expect(r.status).toBe(410);
		expect(r.data?.gone).toMatchObject({ by: isTeam ? 'Ana' : null });
		expect(notes()).toBe('first');
	});

	it(
		isTeam ? 'refuses a save without seen' : 'accepts a save without seen (an old tab)',
		async () => {
			const r = await call(lessonPage.actions.update, post(fields, id));
			if (isTeam) {
				expect(r.status).toBe(400);
				expect(notes()).toBe('first');
			} else {
				expect(r.ok).toBe(true);
				expect(notes()).toBe('mine');
			}
		}
	);

	it(
		isTeam
			? 'refuses a save whose seen leaves out a field it writes'
			: 'accepts a partial seen on its own lesson',
		async () => {
			const seen = JSON.stringify({ title: 'Rueda', lessonDay: '2026-11-01' });
			const r = await call(lessonPage.actions.update, post({ ...fields, seen }, id));
			expect(r.status ?? 200).toBe(isTeam ? 400 : 200);
			expect(notes()).toBe(isTeam ? 'first' : 'mine');
		}
	);
});

describe('a section in the player', () => {
	let spot: number;
	const patch = (body: unknown) =>
		(spotEndpoint.PATCH as unknown as (e: unknown) => Promise<Response>)({
			params: { id: String(spot) },
			request: new Request('http://localhost/', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			}),
			locals: { user: U1 }
		});
	const row = () => db.select().from(videoSpots).where(eq(videoSpots.id, spot)).get()!;

	describe.each([
		['a group lesson', team, true],
		['a personal lesson', own, false]
	] as const)('on %s', (_, space, isTeam) => {
		beforeEach(() => {
			const lesson = createLesson(db, space(), {
				lessonDay: '2026-11-01',
				title: 'L',
				notes: null
			}).lesson.id;
			const video = addLessonVideo(
				db,
				{
					lessonId: lesson,
					file: '00000000-0000-4000-8000-0000000000a1.mp4',
					mime: 'video/mp4',
					sizeBytes: 5
				},
				'u1'
			).id;
			spot = addSpot(
				db,
				{ lessonVideoId: video },
				{ startMs: 1000, endMs: 5000, label: 'A' },
				'u1'
			)!.id;
		});

		it('takes two nudges in a row, each seeing the last answer', async () => {
			let seen = { label: 'A', startMs: 1000, endMs: 5000 };
			for (const startMs of [1100, 1200]) {
				const res = await patch({ startMs, seen });
				expect(res.status).toBe(200);
				const got = (await res.json()) as typeof seen;
				seen = { label: got.label, startMs: got.startMs, endMs: got.endMs };
			}
			expect(row().startMs).toBe(1200);
		});

		it('refuses a nudge that saw an older start, writing nothing', async () => {
			await patch({ startMs: 1500, seen: { startMs: 1000 } });
			const res = await patch({ startMs: 1100, seen: { startMs: 1000 } });
			expect(res.status).toBe(409);
			expect(await res.json()).toMatchObject({
				clash: { changed: ['startMs'], current: { startMs: 1500 } }
			});
			expect(row().startMs).toBe(1500);
		});

		it('checks only the fields it changes', async () => {
			await patch({ label: 'Theirs', seen: { label: 'A' } });
			const res = await patch({ startMs: 1100, seen: { label: 'A', startMs: 1000, endMs: 5000 } });
			expect(res.status).toBe(200);
			expect(row()).toMatchObject({ label: 'Theirs', startMs: 1100 });
		});

		it(isTeam ? 'refuses a nudge without seen' : 'accepts a nudge without seen', async () => {
			const res = await patch({ startMs: 1100 }).catch((e: { status: number }) => e);
			expect(res.status).toBe(isTeam ? 400 : 200);
			expect(row().startMs).toBe(isTeam ? 1000 : 1100);
		});

		it(
			isTeam ? 'refuses a nudge whose seen leaves out what it writes' : 'accepts one on its own',
			async () => {
				const res = await patch({ startMs: 1100, seen: { label: 'A' } }).catch(
					(e: { status: number }) => e
				);
				expect(res.status).toBe(isTeam ? 400 : 200);
				expect(row().startMs).toBe(isTeam ? 1000 : 1100);
			}
		);
	});
});

describe.each([
	['a group routine', team, true],
	['a personal routine', own, false]
] as const)('%s', (_, space, isTeam) => {
	let id: number;
	let a: number;
	let b: number;
	const order = () =>
		db
			.select({ id: routineSteps.id })
			.from(routineSteps)
			.where(eq(routineSteps.routineId, id))
			.orderBy(routineSteps.position)
			.all()
			.map((s) => s.id);

	beforeEach(() => {
		const s = space();
		const fig = (figureName: string) =>
			createFigure(db, s, {
				figureName,
				name: 'Basic',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.figure.id;
		id = createRoutine(db, s, { name: 'R', notes: null }).routine.id;
		a = addFigureSlot(db, id, fig('Enchufla'), 'u1')!;
		b = addFigureSlot(db, id, fig('Dile que no'), 'u1')!;
	});

	it('refuses a slot move with a stale fingerprint, changing nothing', async () => {
		const stale = load(routinePage, id).fingerprint as string;
		const moved = await call(
			routinePage.actions.reorder,
			post({ stepId: String(a), index: '1', fingerprint: stale }, id)
		);
		expect(moved.ok).toBe(true);
		const after = order();
		const r = await call(
			routinePage.actions.reorder,
			post({ stepId: String(a), index: '0', fingerprint: stale }, id)
		);
		expect(r.status).toBe(409);
		expect(r.data?.message).toBe(
			isTeam
				? 'Ana changed this routine; it now shows the latest'
				: 'This routine changed; it now shows the latest'
		);
		expect(order()).toEqual(after);
	});

	it('hands back the new fingerprint, so the next move goes through', async () => {
		const fp = load(routinePage, id).fingerprint as string;
		const first = await call(
			routinePage.actions.reorder,
			post({ stepId: String(a), index: '1', fingerprint: fp }, id)
		);
		const second = await call(
			routinePage.actions.reorder,
			post({ stepId: String(a), index: '0', fingerprint: first.fingerprint! }, id)
		);
		expect(second.ok).toBe(true);
		expect(order()).toEqual([a, b]);
	});

	it(
		isTeam ? 'refuses a slot action without one' : 'accepts one without (an old tab)',
		async () => {
			const r = await call(
				routinePage.actions.reorder,
				post({ stepId: String(a), index: '1' }, id)
			);
			expect(r.status ?? 200).toBe(isTeam ? 400 : 200);
			expect(order()).toEqual(isTeam ? [a, b] : [b, a]);
		}
	);

	it('refuses a rename that saw older notes', async () => {
		const seen = seenOf(load(routinePage, id));
		await call(routinePage.actions.rename, post({ name: 'R', notes: 'theirs', seen }, id));
		const r = await call(routinePage.actions.rename, post({ name: 'Mine', notes: '', seen }, id));
		expect(r.status).toBe(409);
		expect(r.data?.clash).toMatchObject({ changed: ['notes'] });
	});

	it('says gone on a routine archived since, to a rename and a slot action', async () => {
		const data = load(routinePage, id);
		archiveRoutine(db, id, 5, 'u1');
		const renamed = await call(
			routinePage.actions.rename,
			post({ name: 'Mine', notes: '', seen: seenOf(data) }, id)
		);
		expect(renamed.status).toBe(410);
		expect(renamed.data?.gone).toMatchObject({ by: isTeam ? 'Ana' : null });
		const moved = await call(
			routinePage.actions.reorder,
			post({ stepId: String(a), index: '1', fingerprint: data.fingerprint as string }, id)
		);
		expect(moved.status).toBe(410);
		expect(order()).toEqual([a, b]);
		expect(db.select().from(routines).where(eq(routines.id, id)).get()!.name).toBe('R');
	});
});

describe.each([
	['a group figure', team],
	['a personal figure', own]
] as const)('%s', (_, space) => {
	let id: number;
	let form: Record<string, string | string[]>;

	beforeEach(() => {
		id = createFigure(db, space(), {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'first'
		})!.figure.id;
		form = {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'mine',
			endId: '',
			startCount: '1',
			lengthCounts: '8'
		};
	});

	it('refuses a variation save that saw an older figure name', async () => {
		const seen = seenOf(load(figurePage, id));
		const other = await call(
			figurePage.actions.update,
			post({ ...form, notes: 'first', figureName: 'Enchufla doble', seen }, id)
		);
		expect(other.ok).toBe(true);
		const r = await call(figurePage.actions.update, post({ ...form, seen }, id));
		expect(r.status).toBe(409);
		expect(r.data?.clash).toMatchObject({ changed: ['figureName'] });
		expect(db.select().from(figures).where(eq(figures.id, id)).get()!.notes).toBe('first');
	});

	it('saves with a fresh seen', async () => {
		const seen = seenOf(load(figurePage, id));
		expect((await call(figurePage.actions.update, post({ ...form, seen }, id))).ok).toBe(true);
		expect(db.select().from(figures).where(eq(figures.id, id)).get()!.notes).toBe('mine');
	});
});

describe.each([
	['a group drill', team],
	['a personal drill', own]
] as const)('%s', (_, space) => {
	let id: number;
	let form: Record<string, string>;
	beforeEach(() => {
		id = createCustomExercise(db, space(), { name: 'Shines', everyDays: 3, notes: 'first' }).id;
		form = { name: 'Shines', everyDays: '3', active: 'on', notes: 'mine' };
	});

	it('refuses a save that saw an older name, and takes a fresh one', async () => {
		const seen = seenOf(load(exercisePage, id));
		await call(
			exercisePage.actions.update,
			post({ ...form, name: 'Theirs', notes: 'first', seen }, id)
		);
		const r = await call(exercisePage.actions.update, post({ ...form, seen }, id));
		expect(r.status).toBe(409);
		expect(r.data?.clash).toMatchObject({ changed: ['name'], current: { name: 'Theirs' } });
		expect(db.select().from(exercises).where(eq(exercises.id, id)).get()!.notes).toBe('first');
		const fresh = seenOf(load(exercisePage, id));
		const ok = await call(exercisePage.actions.update, post({ ...form, seen: fresh }, id));
		expect(ok.ok).toBe(true);
	});
});
