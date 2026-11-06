import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { positions, teamChanges } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { createTeam, joinTeam } from '$lib/server/teams';
import { addPosition } from '$lib/server/test-positions';
import { crossRefs } from '$lib/server/integrity';
import { U1_BACHATA, U1_SALSA } from '$lib/server/test-walls';
import { POST } from './+server';

const T = 1_790_000_000_000;
const TEAM = { dance: 'salsa', teamId: 1, actorId: 'u5' } as const;
const figureInput = { name: 'Basic', partner: 'partner' as const, notes: null, style: 'salsa' };

let db: Db;
let mine: number;
let theirs: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u5', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	mine = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Enchufla' })!.figure.id;
	theirs = createFigure(db, TEAM, { ...figureInput, figureName: 'Vacilala' })!.figure.id;
});

async function post(
	user: string | null,
	body: unknown,
	dance: 'salsa' | 'bachata' = 'salsa'
): Promise<{ status: number; body: unknown }> {
	const request = new Request('http://x/api/positions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	try {
		const res = await (POST as (e: unknown) => Promise<Response>)({
			request,
			locals: { user: user ? { id: user, dance } : null }
		});
		return { status: res.status, body: await res.json() };
	} catch (e) {
		return { status: (e as { status: number }).status, body: null };
	}
}

const all = () => db.select().from(positions).all();

describe('POST /api/positions', () => {
	it("creates in a person's own space for their figure, with the hold and the type", async () => {
		const res = await post('u1', {
			figureId: mine,
			name: ' Tornillo ',
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: ' Lead with the left. '
		});
		expect(res.status).toBe(201);
		const [row] = all();
		expect(row).toMatchObject({
			name: 'Tornillo',
			dance: 'salsa',
			userId: 'u1',
			teamId: null,
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: 'Lead with the left.',
			archivedAt: null
		});
		expect(res.body).toEqual({
			id: row.id,
			name: 'Tornillo',
			styleTag: 'son',
			hold: { hands: 'two', crossed: true, facing: 'face', frame: 'closed' },
			teamId: null,
			archived: false
		});
		expect(crossRefs(db)).toEqual([]);
	});

	it("creates in the group's space for a group's figure, logged with its editor", async () => {
		// u1's own Cerrada does not stand in the group's way.
		addPosition(db, U1_SALSA, 'Cerrada');
		const res = await post('u5', { figureId: theirs, name: 'Cerrada', styleTag: 'salsa' });
		expect(res.status).toBe(201);
		const made = all().find((p) => p.teamId === 1)!;
		expect(made).toMatchObject({ name: 'Cerrada', userId: null, teamId: 1, styleTag: 'salsa' });
		expect(res.body).toMatchObject({ id: made.id, name: 'Cerrada', teamId: null });
		const log = db
			.select()
			.from(teamChanges)
			.where(and(eq(teamChanges.rootKind, 'position'), eq(teamChanges.rootId, made.id)))
			.all();
		expect(log).toMatchObject([{ teamId: 1, actorId: 'u5', rootKind: 'position', verb: 'add' }]);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses a taken name under the name field, writing nothing', async () => {
		addPosition(db, U1_SALSA, 'Cerrada');
		expect(await post('u1', { figureId: mine, name: 'cerrada', styleTag: 'salsa' })).toEqual({
			status: 400,
			body: { message: 'You already have a position called cerrada.', field: 'name' }
		});
		addPosition(db, TEAM, 'Abierta');
		expect(await post('u5', { figureId: theirs, name: 'ABIERTA', styleTag: null })).toEqual({
			status: 400,
			body: { message: 'Rueda club already has a position called ABIERTA.', field: 'name' }
		});
		expect(all()).toHaveLength(2);
	});

	it('refuses an empty or too long name, and long notes', async () => {
		expect(await post('u1', { figureId: mine, name: '  ', styleTag: 'salsa' })).toMatchObject({
			status: 400,
			body: { field: 'name' }
		});
		expect(
			await post('u1', { figureId: mine, name: 'x'.repeat(201), styleTag: 'salsa' })
		).toMatchObject({ status: 400, body: { field: 'name' } });
		expect(
			await post('u1', { figureId: mine, name: 'Ok', styleTag: 'salsa', notes: 'x'.repeat(2001) })
		).toMatchObject({ status: 400, body: { field: 'notes' } });
		expect(all()).toEqual([]);
	});

	it('drops a type outside the figure’s dance and an unknown hold part', async () => {
		const basico = createFigure(db, U1_BACHATA, {
			...figureInput,
			figureName: 'Basico',
			style: 'sensual'
		})!.figure.id;
		const res = await post(
			'u1',
			{
				figureId: basico,
				name: 'Closed',
				styleTag: 'salsa',
				hands: 'three',
				crossed: 'yes'
			},
			'bachata'
		);
		expect(res.status).toBe(201);
		expect(all()[0]).toMatchObject({
			dance: 'bachata',
			userId: 'u1',
			styleTag: null,
			hands: null,
			crossed: null
		});
	});

	it('is a 404 for a figure the person may not edit, writing nothing', async () => {
		// A member reads the group's figure at most; another person's figure; no such figure.
		expect((await post('u2', { figureId: theirs, name: 'X', styleTag: 'salsa' })).status).toBe(404);
		expect((await post('u2', { figureId: mine, name: 'X', styleTag: 'salsa' })).status).toBe(404);
		expect((await post('u1', { figureId: 9999, name: 'X', styleTag: 'salsa' })).status).toBe(404);
		expect(all()).toEqual([]);
	});

	it('a bad body is 400, no session is 401', async () => {
		expect((await post('u1', 'nope')).status).toBe(400);
		expect((await post('u1', { figureId: 'x', name: 'X' })).status).toBe(400);
		expect((await post('u1', { figureId: mine })).status).toBe(400);
		expect((await post(null, { figureId: mine, name: 'X' })).status).toBe(401);
		expect(all()).toEqual([]);
	});
});
