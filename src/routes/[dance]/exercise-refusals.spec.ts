/**
 * What the Done sheet and the exercise page say when they refuse, in the
 * person's language. The hook runs every action inside `runInLocale`; here the
 * actions run inside it directly. `getDb()` is mocked for the reason
 * `dance-wall.spec.ts` gives.
 *
 * Catches: a refusal left in English for someone who reads none.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { sets } from '$lib/server/db/schema';
import { createCustomExercise } from '$lib/server/exercises';
import { addFigureExercise, createFigure } from '$lib/server/figures';
import { runInLocale } from '$lib/server/i18n-request';
import { U1_SALSA } from '$lib/server/test-walls';
import { actions } from './(today)/exercises/[id]/+page.server';

const U1 = { id: 'u1', email: 'u1@x.si', timezone: 'UTC', dance: 'salsa', isAdmin: false };

function post(fields: Record<string, string>, id: number) {
	return {
		params: { dance: 'salsa', id: String(id) },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: U1 },
		url: new URL('http://localhost/')
	};
}
type Invoke = (event: ReturnType<typeof post>) => unknown;
const call = async (name: keyof typeof actions, fields: Record<string, string>, id: number) =>
	(await (actions[name] as unknown as Invoke)(post(fields, id))) as {
		status?: number;
		data?: { message?: string };
	};
const sl = <T>(fn: () => Promise<T>) => runInLocale('sl', fn);

let db: Db;
let drill: number;
let figureExercise: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	drill = createCustomExercise(db, U1_SALSA, { name: 'Hips', everyDays: 2, notes: null }).id;
	figureExercise = addFigureExercise(
		db,
		'u1',
		createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id
	)!.id;
});

describe('Done and the history refuse in Slovenian', () => {
	it('a bad value, a missing face, a day already gone and one that cannot come back', async () => {
		const id = String(drill);
		const message = async (name: keyof typeof actions, fields: Record<string, string>) =>
			(await sl(() => call(name, fields, drill))).data?.message;
		expect(await message('done', { exerciseId: id, rating: '9' })).toBe(
			'Preverite vrednosti in poskusite znova.'
		);
		expect(await message('done', { exerciseId: id })).toBe('Izberite, kako je šlo');
		expect(await message('deleteDay', { exerciseId: id, day: '2026-10-01' })).toBe(
			'Ta dan je že izbrisan.'
		);
		expect(await message('restoreDay', { snapshots: 'junk' })).toBe('Dneva ni bilo mogoče vrniti.');
		expect(db.select().from(sets).all()).toEqual([]);
	});

	it('and in English', async () => {
		const id = String(drill);
		expect((await call('done', { exerciseId: id }, drill)).data?.message).toBe('Pick how it went');
		expect(
			(await call('deleteDay', { exerciseId: id, day: '2026-10-01' }, drill)).data?.message
		).toBe('That day was already removed.');
		expect((await call('restoreDay', { snapshots: '[]' }, drill)).data?.message).toBe(
			'That day could not be put back.'
		);
	});
});

describe('the exercise page refuses in Slovenian', () => {
	it('settings it cannot read, an archive that is not its to make, a section or link missing', async () => {
		expect(
			(await sl(() => call('update', { name: 'Hips', notes: 'x'.repeat(2001) }, drill))).data
				?.message
		).toBe('Preverite vrednosti in poskusite znova.');
		expect((await sl(() => call('archive', {}, figureExercise))).data?.message).toBe(
			'Tukaj se arhivirajo le lastne vaje. Različico arhivirate na njeni strani.'
		);
		expect((await sl(() => call('linkSection', {}, drill))).data?.message).toBe('Izberite odsek.');
		expect((await sl(() => call('unlinkSection', { linkId: '999' }, drill))).data?.message).toBe(
			'Ta povezava je že odstranjena.'
		);
	});

	it('and in English', async () => {
		expect((await call('linkSection', {}, drill)).data?.message).toBe('Pick a section.');
		expect((await call('archive', {}, figureExercise)).data?.message).toBe(
			'Only custom exercises are archived here. Archive a figure from its page.'
		);
	});
});
