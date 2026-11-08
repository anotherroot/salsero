/**
 * The figure page's refusals in the reader's language: each action composes its
 * message inside the request, so a Slovenian request reads Slovenian, with the
 * move's name after a colon or a "·", never declined. English is unchanged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { addFigureExercise, createFigure, createVariationIn } from '$lib/server/figures';
import { runInLocale } from '$lib/server/i18n-request';
import { U1_SALSA } from '$lib/server/test-walls';
import { actions } from './+page.server';
import { POST as uploadRecording } from '../../../../api/figures/[id]/recordings/+server';

const U1 = { id: 'u1', email: 'u1@x.si', timezone: 'UTC', dance: 'salsa', isAdmin: false };
const INPUT = { partner: 'partner' as const, style: 'salsa', notes: null };

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
type Action = keyof typeof actions;
const act = async (name: Action, id: number, fields: Record<string, string> = {}) =>
	(await (actions[name] as (e: unknown) => unknown)(post(fields, id))) as {
		status?: number;
		data?: Record<string, unknown>;
	};
const sl = <T>(fn: () => Promise<T>): Promise<T> => runInLocale('sl', fn);

let db: Db;
let basica: number;
let doble: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' })
		.run();
	const made = createFigure(db, U1_SALSA, { ...INPUT, figureName: 'Enchufla', name: 'Básica' })!;
	basica = made.figure.id;
	doble = createVariationIn(db, made.group.id, { ...INPUT, name: 'Doble' })!.id;
	createFigure(db, U1_SALSA, { ...INPUT, figureName: 'Setenta', name: 'Básica' });
});

const save = (fields: Partial<Record<string, string>>) =>
	({
		figureName: 'Enchufla',
		name: 'Doble',
		partner: 'partner',
		style: 'salsa',
		notes: '',
		startCount: '1',
		lengthCounts: '8',
		...fields
	}) as Record<string, string>;

describe('the figure page in Slovenian', () => {
	it('a name taken in the move: the move after a colon, not declined', async () => {
		expect(await sl(() => act('update', doble, save({ name: 'Básica' })))).toMatchObject({
			status: 400,
			data: {
				message: 'Različica s tem imenom že obstaja: Enchufla · Básica. Najprej eno preimenujte.'
			}
		});
		expect(await sl(() => act('update', doble, save({ figureName: 'Setenta' })))).toMatchObject({
			data: { message: 'Figura s tem imenom že obstaja: Setenta.' }
		});
	});

	it('refuses a blank name and a timing out of range', async () => {
		expect(await sl(() => act('update', doble, save({ name: ' ' })))).toMatchObject({
			data: { message: 'Vpišite ime figure in različice (do 200 znakov).' }
		});
		expect(await sl(() => act('update', doble, save({ lengthCounts: '0' })))).toMatchObject({
			data: {
				message: 'Različica se začne na eni od dob 1–8 in traja od 1 do 64 dob.'
			}
		});
	});

	it('New figure and Move to… refuse in Slovenian', async () => {
		expect(await sl(() => act('createVariation', doble, { name: '' }))).toMatchObject({
			data: { message: 'Vpišite ime različice (do 200 znakov).' }
		});
		expect(await sl(() => act('createVariation', doble, { name: 'Básica' }))).toMatchObject({
			data: {
				message: 'Različica s tem imenom že obstaja: Enchufla · Básica. Najprej eno preimenujte.'
			}
		});
		expect(await sl(() => act('move', doble, { target: 'new', figureName: '' }))).toMatchObject({
			data: { message: 'Vpišite ime nove figure (do 200 znakov).' }
		});
		expect(await sl(() => act('move', doble, { target: 'x' }))).toMatchObject({
			data: { message: 'Izberite, kam jo želite premakniti.' }
		});
	});

	it('Practise, a recording and a link already gone', async () => {
		addFigureExercise(db, 'u1', basica);
		expect(await sl(() => act('practise', basica))).toMatchObject({
			data: { message: 'To različico že vadite samostojno.' }
		});
		expect(await sl(() => act('deleteRecording', basica, { recordingId: '999' }))).toMatchObject({
			data: { message: 'Ta posnetek je bil že odstranjen.' }
		});
		expect(await sl(() => act('unlinkSection', basica, { linkId: '999' }))).toMatchObject({
			data: { message: 'Ta povezava je bila že odstranjena.' }
		});
		expect(await sl(() => act('linkSection', basica, {}))).toMatchObject({
			data: { message: 'Izberite odsek.' }
		});
	});

	it('the recordings upload refuses what is not a video or audio file', async () => {
		const upload = () =>
			(uploadRecording as (e: unknown) => Promise<unknown>)({
				params: { id: String(basica) },
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'text/plain' },
					body: 'x'
				}),
				locals: { user: U1 }
			}).catch((e: unknown) => e);
		expect(await sl(upload)).toMatchObject({
			status: 415,
			body: { message: 'Naložiti je mogoče le video in zvočne datoteke.' }
		});
		expect(await upload()).toMatchObject({
			body: { message: 'Only video and audio files can be uploaded.' }
		});
	});

	it('English is unchanged', async () => {
		expect(await act('update', doble, save({ name: 'Básica' }))).toMatchObject({
			data: { message: 'Enchufla already has a figure called Básica. Rename one first.' }
		});
		expect(await act('practise', doble).then(() => act('practise', doble))).toMatchObject({
			data: { message: 'This figure is already practised on its own.' }
		});
	});
});
