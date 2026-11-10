/**
 * A tab per source, through the item pages: each load sends the family the
 * person reads as tabs, its subtitle's facts and a checked `?vs=`; the figure
 * page opened from the person's copy marks the recordings already in it, and
 * `takeRecording` brings one over. Group mode keeps the tabs. The database is
 * in memory and the files are fakes: nothing touches `$DATA_DIR`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
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

import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { positions, recordings, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { addRecording, createFigure } from '$lib/server/figures';
import { createRoutine } from '$lib/server/routines';
import { createLesson, linkFigure, linkRoutine, publishLesson } from '$lib/server/lessons';
import { cloneInto } from '$lib/server/clones/clone';
import { NO_FILES, T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
// The group view is in the address now (`?in=`); a jar only carries the group a test's URL names.
const VIEW = 'view';
import type { Wall } from '$lib/server/scope';
import * as figurePage from './(moves)/figures/[id]/+page.server';
import * as routinePage from './(moves)/routines/[id]/+page.server';
import * as syncApi from '../api/clones/sync/+server';
import * as copyApi from '../api/clones/copy/+server';
import * as moveApi from '../api/clones/move/+server';
import * as lessonPage from './lessons/[id]/+page.server';
import * as drillPage from './(today)/exercises/[id]/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as positionPage from './(moves)/positions/[id]/+page.server';
import { archiveVariation } from '$lib/server/figures';
import { figures, lessons } from '$lib/server/db/schema';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
let db: Db;

function jar(group?: number): Cookies {
	return {
		get: (n: string) => (n === VIEW && group ? String(group) : undefined),
		set: () => {},
		delete: () => {}
	} as unknown as Cookies;
}
const ev = (
	uid: string,
	id: number,
	opts: { search?: string; group?: number; form?: object } = {}
) =>
	({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
		cookies: jar(opts.group),
		url: new URL(`http://localhost/salsa/x/${id}${opts.search ?? ''}`),
		request: new Request('http://localhost/x', {
			method: 'POST',
			body: new URLSearchParams(
				Object.entries(opts.form ?? {}).map(([k, v]) => [k, String(v)] as [string, string])
			)
		})
	}) as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Answer = Record<string, any>;
async function run(fn: unknown, e: unknown): Promise<Answer> {
	try {
		return (await (fn as (e: unknown) => unknown)(e)) as Answer;
	} catch (thrown) {
		return thrown as Answer;
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2', 'u3', 'u4'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	joinTeam(db, 'u2', 1, T);
	joinTeam(db, 'u3', 1, T);
	setRole(db, 1, 'u3', 'editor');
});

function published(link: (id: number) => void) {
	const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 4', notes: null })
		.lesson.id;
	link(id);
	publishLesson(db, T1_SALSA, id, T);
	return id;
}
const recording = (figureId: number, file: string) =>
	addRecording(
		db,
		{ figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes: 40, note: null },
		'u1'
	).id;
async function copyInto(kind: 'figure' | 'routine', id: number, wall: Wall) {
	const r = await cloneInto(db, { kind, id, into: wall, recordings: false }, NO_FILES, T);
	if (!r.ok) throw new Error('copy refused');
	return r.id;
}

/** Salsa Tuesdays' Setenta · Básico (F) with two recordings, published; u2's copy (C). */
async function setenta() {
	const F = createFigure(db, T1_SALSA, { figureName: 'Setenta', name: 'Básico', ...shape })!.figure
		.id;
	const first = recording(F, 'first.mp4');
	const second = recording(F, 'second.mp4');
	published((id) => linkFigure(db, id, F, 'u1'));
	const C = await copyInto('figure', F, U2_SALSA);
	return { F, C, first, second };
}

describe('the figure page', () => {
	it('your copy: tabs Yours | Salsa Tuesdays, from Salsa Tuesdays, nothing to take', async () => {
		const { F, C } = await setenta();
		const page = await run(figurePage.load, ev('u2', C));
		expect(page.sources.map((s: Answer) => [s.id, s.label, s.relation])).toEqual([
			[C, 'Yours', 'self'],
			[F, 'Salsa Tuesdays', 'clone']
		]);
		expect(page.cloneLine).toMatchObject({ self: { kind: 'mine' }, clonedFrom: 'Salsa Tuesdays' });
		expect(page.mineId).toBe(C);
		expect(page.taking).toBeNull();
	});

	it('the source’s tab opened from your copy: what is in yours, and Take', async () => {
		const { F, C, first, second } = await setenta();
		const page = await run(figurePage.load, ev('u2', F, { search: `?vs=${C}` }));
		expect(page.taking).toEqual({ into: C, held: { [first]: false, [second]: false } });
		// Without vs, or a vs that is not yours, it is the group's page as before.
		expect((await run(figurePage.load, ev('u2', F))).taking).toBeNull();
		expect((await run(figurePage.load, ev('u2', F, { search: `?vs=${F}` }))).taking).toBeNull();

		const took = await run(
			figurePage.actions.takeRecording,
			ev('u2', F, { form: { recordingId: first, into: C } })
		);
		expect(took).toEqual({ action: 'takeRecording', taken: first });
		expect(db.select().from(recordings).where(eq(recordings.figureId, C)).all()).toHaveLength(1);
		const after = await run(figurePage.load, ev('u2', F, { search: `?vs=${C}` }));
		expect(after.taking.held).toEqual({ [first]: true, [second]: false });

		const again = await run(
			figurePage.actions.takeRecording,
			ev('u2', F, { form: { recordingId: first, into: C } })
		);
		expect(again).toMatchObject({
			status: 409,
			data: { action: 'takeRecording', recordingId: first }
		});
	});

	it('Take refuses a recording of another figure, and into a figure not yours', async () => {
		const { F, C, first } = await setenta();
		const other = createFigure(db, U2_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!
			.figure.id;
		const stray = await run(
			figurePage.actions.takeRecording,
			ev('u2', C, { form: { recordingId: first, into: C } })
		);
		expect(stray).toMatchObject({ status: 404 });
		const wrong = await run(
			figurePage.actions.takeRecording,
			ev('u2', F, { form: { recordingId: first, into: other } })
		);
		expect(wrong).toMatchObject({ status: 404 });
		// An outsider never reaches the action.
		const outsider = await run(
			figurePage.actions.takeRecording,
			ev('u4', F, { form: { recordingId: first, into: C } })
		);
		expect(outsider).toMatchObject({ status: 404 });
		expect(db.select().from(recordings).where(eq(recordings.figureId, C)).all()).toEqual([]);
	});

	it('keeps its tabs in group mode, from the editor’s own view', async () => {
		const { F } = await setenta();
		const mine = await copyInto('figure', F, { userId: 'u3', dance: 'salsa' });
		const page = await run(figurePage.load, ev('u3', F, { group: 1 }));
		expect(page.sources.map((s: Answer) => [s.id, s.label, s.access])).toEqual([
			[mine, 'Yours', 'edit'],
			[F, 'Salsa Tuesdays', 'edit']
		]);
		// u2's own copy is u2's: the editor never sees it.
		expect(page.sources).toHaveLength(2);
	});
});

describe('the notice and Keep in step', () => {
	it('your copy’s page says the group changed it; a Sync clears it', async () => {
		const { F, C } = await setenta();
		expect((await run(figurePage.load, ev('u2', C))).step).toEqual({ lines: [] });
		db.update(figures).set({ startCount: 3 }).where(eq(figures.id, F)).run();
		const page = await run(figurePage.load, ev('u2', C));
		expect(page.step).toEqual({
			lines: [{ id: F, place: 'Salsa Tuesdays', state: 'changed', fields: ['Timing'] }]
		});
		expect(page.keep).toMatchObject({ editable: true, mode: 'update' });
		expect(page.compare).toBeUndefined();
	});

	it('keep: the copy’s editor saves the five switches; a reader and a bad form are refused', async () => {
		const { F, C } = await setenta();
		const form = { on: '1', names: '0', small: '1', sections: '1', media: '0' };
		expect(await run(figurePage.actions.keep, ev('u2', C, { form }))).toEqual({
			action: 'keep',
			settings: { on: true, names: false, small: true, sections: true, media: false }
		});
		expect((await run(figurePage.load, ev('u2', C))).keep.settings).toMatchObject({
			names: false,
			sections: true
		});
		// u2 only reads the group's: the level shows its switches disabled, and a post is the missing row.
		expect((await run(figurePage.load, ev('u2', F))).keep).toMatchObject({ editable: false });
		expect(await run(figurePage.actions.keep, ev('u2', F, { form }))).toMatchObject({
			status: 404
		});
		expect(
			await run(figurePage.actions.keep, ev('u2', C, { form: { ...form, media: 'yes' } }))
		).toMatchObject({ status: 400 });
		expect(await run(figurePage.actions.keep, ev('u4', C, { form }))).toMatchObject({
			status: 404
		});
	});

	it('every item page has the keep action, and none the old take or send', () => {
		for (const page of [figurePage, routinePage, lessonPage, drillPage, songPage, positionPage]) {
			const a = page.actions as Answer;
			expect(typeof a.keep).toBe('function');
			expect([a.take, a.send, a.keepMine]).toEqual([undefined, undefined, undefined]);
		}
	});

	it('an editor’s tab of the group, opened from their copy, is no read-only source', async () => {
		const { F } = await setenta();
		const mine = await copyInto('figure', F, { userId: 'u3', dance: 'salsa' });
		const page = await run(figurePage.load, ev('u3', F, { search: `?vs=${mine}` }));
		expect(page.vs).toBeUndefined();
		expect(page.taking).toBeNull();
	});
});

describe('Copies you can see', () => {
	it('an editor’s own copy lists the group’s, behind it', async () => {
		const { F } = await setenta();
		const mine = await copyInto('figure', F, { userId: 'u3', dance: 'salsa' });
		db.update(figures).set({ notes: 'Hips first' }).where(eq(figures.id, mine)).run();
		const page = await run(figurePage.load, ev('u3', mine));
		expect(
			page.family.entries.map((e: Answer) => [e.member.id, e.role, e.status, e.changed])
		).toEqual([
			[mine, null, null, ['Notes']],
			[F, 'editor', 'behind', ['Notes']]
		]);
		expect(page.keep).toMatchObject({ editable: true, mode: 'sync' });
	});
});

describe('Sync', () => {
	const preview = (uid: string, kind: string, id: number) =>
		run(syncApi.GET, {
			url: new URL(`http://localhost/api/clones/sync?kind=${kind}&id=${id}`),
			locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } }
		});

	it('an editor’s own copy syncs into the group’s; a stale sheet is refused for that copy', async () => {
		const { F } = await setenta();
		const mine = await copyInto('figure', F, { userId: 'u3', dance: 'salsa' });
		db.update(figures).set({ notes: 'Hips first' }).where(eq(figures.id, mine)).run();
		const view = await (await preview('u3', 'figure', mine)).json();
		expect(view.mode).toBe('sync');
		expect(view.targets.map((t: Answer) => [t.id, t.role])).toEqual([
			[mine, 'this one'],
			[F, 'editor']
		]);
		const form = {
			picks: '{}',
			targets: JSON.stringify(view.targets.map((t: Answer) => ({ id: t.id, seen: t.seen }))),
			members: JSON.stringify(view.members)
		};
		expect(await run(figurePage.actions.sync, ev('u3', mine, { form }))).toEqual({
			action: 'sync',
			refused: []
		});
		expect(db.select().from(figures).where(eq(figures.id, F)).get()!.notes).toBe('Hips first');
		// The same sheet again: the group's changed since it was opened.
		db.update(figures).set({ notes: 'Later' }).where(eq(figures.id, F)).run();
		expect(await run(figurePage.actions.sync, ev('u3', mine, { form }))).toMatchObject({
			action: 'sync',
			refused: [{ id: F }]
		});
	});

	it('a reader updates only their own; the group’s copy as a target is the missing row', async () => {
		const { F, C } = await setenta();
		db.update(figures).set({ notes: 'Club' }).where(eq(figures.id, F)).run();
		const view = await (await preview('u2', 'figure', C)).json();
		expect(view).toMatchObject({ mode: 'update', title: 'Update from Salsa Tuesdays' });
		const seen = (id: number) => view.targets.find((t: Answer) => t.id === id)?.seen;
		const into = (targets: object[]) => ({
			picks: '{}',
			targets: JSON.stringify(targets),
			members: JSON.stringify(view.members)
		});
		expect(
			await run(figurePage.actions.sync, ev('u2', C, { form: into([{ id: F, seen: 'x' }]) }))
		).toMatchObject({ status: 404 });
		expect(
			await run(figurePage.actions.sync, ev('u2', C, { form: into([{ id: C, seen: seen(C) }]) }))
		).toEqual({ action: 'sync', refused: [] });
		expect(db.select().from(figures).where(eq(figures.id, C)).get()!.notes).toBe('Club');
		expect(await preview('u4', 'figure', C)).toMatchObject({ status: 404 });
		expect(await preview('u2', 'nonsense', C)).toMatchObject({ status: 404 });
		expect(
			await run(figurePage.actions.sync, ev('u2', C, { form: { picks: '{}', targets: '[]' } }))
		).toMatchObject({ status: 400 });
		expect(
			await run(figurePage.actions.sync, ev('u2', C, { form: { picks: '[1]', targets: '[]' } }))
		).toMatchObject({ status: 400 });
	});

	it('an open row is a 409 with its words', async () => {
		const { F, C } = await setenta();
		db.update(figures).set({ notes: 'Club' }).where(eq(figures.id, F)).run();
		db.update(figures).set({ notes: 'Mine' }).where(eq(figures.id, C)).run();
		const view = await (await preview('u2', 'figure', C)).json();
		const form = {
			picks: '{}',
			targets: JSON.stringify([{ id: C, seen: view.targets[0].seen }]),
			members: JSON.stringify(view.members)
		};
		expect(await run(figurePage.actions.sync, ev('u2', C, { form }))).toMatchObject({
			status: 409,
			data: { action: 'sync', reason: 'pick' }
		});
	});

	it('every item page has the action', () => {
		for (const page of [figurePage, routinePage, lessonPage, drillPage, songPage, positionPage])
			expect(typeof (page.actions as Answer).sync).toBe('function');
	});
});

describe('the other pages', () => {
	it('a routine copy has its tabs too; a lone routine none', async () => {
		const R = createRoutine(db, T1_SALSA, { name: 'Class routine', notes: null }).routine.id;
		published((id) => linkRoutine(db, id, R, 'u1'));
		expect((await run(routinePage.load, ev('u2', R))).sources).toEqual([]);
		const mine = await copyInto('routine', R, U2_SALSA);
		const page = await run(routinePage.load, ev('u2', mine));
		expect(page.sources.map((s: Answer) => s.label)).toEqual(['Yours', 'Salsa Tuesdays']);
		expect((await run(routinePage.load, ev('u2', R, { search: `?vs=${mine}` }))).vs).toBe(mine);
	});
});

describe('Drop my copy', () => {
	it('your copy offers it; the drop lands on the class’s page; Edit then brings the copy back', async () => {
		const { F, C } = await setenta();
		const page = await run(figurePage.load, ev('u2', C));
		expect(page.drop).toMatchObject({
			kind: 'figure',
			preselected: F,
			choices: [
				{
					id: F,
					label: 'Setenta · Básico',
					clonedFrom: true,
					// u2 has no practice on the copy: nothing needs Week 4 added.
					practiceFollows: true,
					addLesson: null
				}
			]
		});
		// The group's page offers nothing to drop.
		expect((await run(figurePage.load, ev('u2', F))).drop).toBeNull();

		const res = await run(figurePage.actions.drop, ev('u2', C, { form: { to: F } }));
		expect(res).toMatchObject({ status: 303, location: `/salsa/figures/${F}` });
		expect(db.select().from(figures).where(eq(figures.id, C)).get()!.archivedAt).not.toBeNull();
		// Dropped already: nothing to drop any more.
		expect(await run(figurePage.actions.drop, ev('u2', C, { form: { to: F } }))).toMatchObject({
			status: 404
		});

		// Review Focus 4: Edit on the class's figure restores the same copy.
		const again = await run(figurePage.actions.makeMine, ev('u2', F));
		expect(again).toMatchObject({ status: 303, location: `/salsa/figures/${C}` });
		expect(db.select().from(figures).where(eq(figures.id, C)).get()!.archivedAt).toBeNull();
	});

	it('a version not offered is a 409; a malformed form 400; someone else’s copy 404', async () => {
		const { F, C } = await setenta();
		expect(await run(figurePage.actions.drop, ev('u2', C, { form: { to: C } }))).toMatchObject({
			status: 409,
			data: { action: 'drop' }
		});
		expect(await run(figurePage.actions.drop, ev('u2', C, { form: {} }))).toMatchObject({
			status: 400
		});
		expect(
			await run(figurePage.actions.drop, ev('u2', C, { form: { to: F, addLesson: 'x' } }))
		).toMatchObject({ status: 400 });
		expect(await run(figurePage.actions.drop, ev('u3', C, { form: { to: F } }))).toMatchObject({
			status: 404
		});
		expect(db.select().from(figures).where(eq(figures.id, C)).get()!.archivedAt).toBeNull();
	});
});

describe('Copy to…', () => {
	/** Rueda club (T2, u4's), which u3 edits too; Salsa Tuesdays' Setenta · Básico (F). */
	function rueda() {
		createTeam(db, 'u4', 'salsa', 'Rueda club', T);
		joinTeam(db, 'u3', 2, T);
		setRole(db, 2, 'u3', 'editor');
		const F = createFigure(db, T1_SALSA, { figureName: 'Setenta', name: 'Básico', ...shape })!
			.figure.id;
		recording(F, 'first.mp4');
		return F;
	}
	const plan = async (uid: string, id: number, into: string) =>
		run(copyApi.GET, {
			url: new URL(`http://localhost/api/clones/copy?kind=figure&id=${id}&into=${into}`),
			locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } }
		});

	it('an editor copies a group’s figure into another group; again opens Sync; archived offers Restore', async () => {
		const F = rueda();
		const page = await run(figurePage.load, ev('u3', F));
		expect(page.copyTo).toMatchObject({
			kind: 'figure',
			title: 'Setenta · Básico',
			fromMine: false
		});
		expect(page.copyTo.targets.map((t: Answer) => [t.place, t.role])).toEqual([
			[{ kind: 'mine' }, null],
			[{ kind: 'team', teamId: 2, name: 'Rueda club' }, 'editor']
		]);
		expect(await (await plan('u3', F, '2')).json()).toMatchObject({
			goes: '1 recording (<1 MB, charged to the group)',
			already: [],
			twins: []
		});

		const made = await run(figurePage.actions.copyTo, ev('u3', F, { form: { into: '2' } }));
		expect(made).toMatchObject({ action: 'copy', href: `/salsa/figures/${made.copied}` });
		const copy = db.select().from(figures).where(eq(figures.id, made.copied)).get()!;
		expect(copy).toMatchObject({ teamId: 2, clonedFrom: F });

		expect(await run(figurePage.actions.copyTo, ev('u3', F, { form: { into: '2' } }))).toEqual({
			action: 'copy',
			existing: made.copied,
			href: `/salsa/figures/${made.copied}`,
			from: F,
			place: 'Salsa Tuesdays'
		});

		archiveVariation(db, made.copied, T + 1, 'u3');
		expect(await run(figurePage.actions.copyTo, ev('u3', F, { form: { into: '2' } }))).toEqual({
			action: 'copy',
			restore: made.copied
		});
		// A forged `use` naming a row of a group u3 is not in steers nothing and names no place.
		createTeam(db, 'u2', 'salsa', 'Secret club', T);
		const X = createFigure(
			db,
			{ teamId: 3, actorId: 'u2', dance: 'salsa' },
			{
				figureName: 'Secret',
				name: 'Básico',
				...shape
			}
		)!.figure.id;
		const gene = db.select().from(figures).where(eq(figures.id, F)).get()!.geneId!;
		const back = await run(
			figurePage.actions.copyTo,
			ev('u3', F, {
				form: { into: '2', restore: made.copied, use: JSON.stringify({ [gene]: X }) }
			})
		);
		expect(back).toEqual({
			action: 'copy',
			existing: made.copied,
			href: `/salsa/figures/${made.copied}`,
			from: F,
			place: 'Salsa Tuesdays'
		});
		expect(
			db.select().from(figures).where(eq(figures.id, made.copied)).get()!.archivedAt
		).toBeNull();
	});

	it('nowhere to go is no offer and 404; a malformed form 400', async () => {
		const F = rueda();
		// u2 only reads T1 (through no lesson): nothing to read, nothing offered.
		expect((await run(figurePage.load, ev('u2', F))).copyTo ?? null).toBeNull();
		// u3 edits T1, the figure's own place: not a target.
		expect(
			await run(figurePage.actions.copyTo, ev('u3', F, { form: { into: '1' } }))
		).toMatchObject({ status: 404 });
		expect(await plan('u3', F, '1')).toMatchObject({ status: 404 });
		expect(await plan('u4', F, 'mine')).toMatchObject({ status: 404 });
		expect(
			await run(figurePage.actions.copyTo, ev('u3', F, { form: { into: '2', use: '[1]' } }))
		).toMatchObject({ status: 400 });
		expect(await run(figurePage.actions.copyTo, ev('u3', F, { form: {} }))).toMatchObject({
			status: 400
		});
	});
});

describe('Move to…', () => {
	const preview = async (uid: string, id: number, into: string) =>
		run(moveApi.GET, {
			url: new URL(`http://localhost/api/clones/move?id=${id}&into=${into}`),
			locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } }
		});
	/** A lesson of the person's own, Week 3, with their own Setenta · Básico. */
	function week3(uid: string) {
		const wall = { userId: uid, dance: 'salsa' as const };
		const F = createFigure(db, wall, { figureName: 'Setenta', name: 'Básico', ...shape })!.figure
			.id;
		const L = createLesson(db, wall, { lessonDay: '2026-11-01', title: 'Week 3', notes: null })
			.lesson.id;
		linkFigure(db, L, F);
		return { F, L };
	}

	it('an editor moves their own lesson into the group: a draft opens, theirs is archived', async () => {
		const { F, L } = week3('u3');
		const page = await run(lessonPage.load, ev('u3', L));
		expect(page.move).toMatchObject({ title: 'Week 3' });
		expect(page.move.targets.map((t: Answer) => t.place)).toEqual([
			{ kind: 'team', teamId: 1, name: 'Salsa Tuesdays' }
		]);
		expect((await (await preview('u3', L, '1')).json()).items).toEqual([
			{
				kind: 'figure',
				id: F,
				label: 'Setenta · Básico',
				why: 'Only this lesson',
				keepByDefault: false,
				practised: false
			}
		]);

		const moved = await run(
			lessonPage.actions.moveTo,
			ev('u3', L, { form: { into: '1', choices: JSON.stringify({ [`figure:${F}`]: 'group' }) } })
		);
		expect(moved).toMatchObject({ status: 303 });
		const id = Number(/\/salsa\/lessons\/(\d+)$/.exec(moved.location)![1]);
		expect(db.select().from(lessons).where(eq(lessons.id, id)).get()).toMatchObject({
			teamId: 1,
			publishedAt: null
		});
		expect(db.select().from(lessons).where(eq(lessons.id, L)).get()!.archivedAt).not.toBeNull();
		expect(db.select().from(figures).where(eq(figures.id, F)).get()!.archivedAt).not.toBeNull();
	});

	it('a member has nowhere to move to: no offer, 404; a malformed form 400', async () => {
		const { L } = week3('u2');
		expect((await run(lessonPage.load, ev('u2', L))).move).toBeNull();
		expect(await preview('u2', L, '1')).toMatchObject({ status: 404 });
		expect(
			await run(lessonPage.actions.moveTo, ev('u2', L, { form: { into: '1' } }))
		).toMatchObject({ status: 404 });
		// Someone else's lesson: the same 404.
		expect(await preview('u3', L, '1')).toMatchObject({ status: 404 });
		const mine = week3('u3').L;
		expect(
			await run(lessonPage.actions.moveTo, ev('u3', mine, { form: { into: '1', choices: '[1]' } }))
		).toMatchObject({ status: 400 });
		expect(
			await run(
				lessonPage.actions.moveTo,
				ev('u3', mine, { form: { into: '1', choices: JSON.stringify({ 'figure:999': 'group' }) } })
			)
		).toMatchObject({ status: 409 });
		expect(db.select().from(lessons).where(eq(lessons.id, mine)).get()!.archivedAt).toBeNull();
	});
});

describe('Same as… and Separate on the figure page', () => {
	it('offers the other figures, saves the ticked set, and Separate undoes it', async () => {
		const a = createFigure(db, U2_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!
			.figure.id;
		const b = createFigure(db, U2_SALSA, { figureName: 'Setenta', name: 'Basic', ...shape })!.figure
			.id;
		const before = await run(figurePage.load, ev('u2', a));
		expect(before.sameAs.title).toBe('Enchufla · Doble');
		expect(before.sameAs.candidates).toEqual([
			{ id: b, label: 'Setenta · Basic', place: { kind: 'mine' }, ticked: false }
		]);
		expect(before.sources).toEqual([]);

		expect(await run(figurePage.actions.sameAs, ev('u2', a, { form: { twin: b } }))).toEqual({
			action: 'sameAs'
		});
		const twinned = await run(figurePage.load, ev('u2', a));
		expect(twinned.sources.map((s: Answer) => [s.id, s.relation])).toEqual([
			[a, 'self'],
			[b, 'twin']
		]);
		expect(twinned.sameAs.candidates[0].ticked).toBe(true);
		// A stranger's figure is no candidate: refused.
		expect(
			await run(figurePage.actions.sameAs, ev('u2', a, { form: { twin: 99999 } }))
		).toMatchObject({ status: 400 });

		await run(figurePage.actions.separate, ev('u2', a));
		expect((await run(figurePage.load, ev('u2', a))).sources).toEqual([]);
	});
});

describe('positions through the clone routes', () => {
	const as = (uid: string, url: string) => ({
		url: new URL(`http://localhost${url}`),
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } }
	});
	const own = (uid: string, name: string) =>
		db
			.insert(positions)
			.values({ dance: 'salsa', userId: uid, slug: `p-${name}`, name, hands: 'two' })
			.returning()
			.get().id;

	it('Copy to… plans a position; Sync sees it; an outsider gets 404', async () => {
		const P = own('u3', 'Cerrada');
		const plan = await run(copyApi.GET, as('u3', `/api/clones/copy?kind=position&id=${P}&into=1`));
		expect(await plan.json()).toEqual({
			goes: 'Just the position',
			bytes: 0,
			already: [],
			twins: [],
			// The Copy and link card's (link from other places): nothing links it from a lesson video.
			staysBehind: 0,
			usedBytes: 0,
			limitBytes: expect.any(Number)
		});
		expect(
			await run(copyApi.GET, as('u2', `/api/clones/copy?kind=position&id=${P}&into=1`))
		).toMatchObject({ status: 404 });

		const r = await cloneInto(
			db,
			{
				kind: 'position',
				id: P,
				into: { dance: 'salsa', teamId: 1, actorId: 'u3' },
				recordings: true
			},
			NO_FILES,
			T
		);
		if (!r.ok) throw new Error('copy refused');
		db.update(positions).set({ hands: 'one' }).where(eq(positions.id, r.id)).run();
		const view = await (
			await run(syncApi.GET, as('u3', `/api/clones/sync?kind=position&id=${P}`))
		).json();
		expect(view.rows.map((r: Answer) => r.key)).toEqual(['hands']);
		expect(view.targets.map((t: Answer) => t.id)).toEqual([P, r.id]);
		expect(
			await run(syncApi.GET, as('u4', `/api/clones/sync?kind=position&id=${P}`))
		).toMatchObject({ status: 404 });
	});
});
