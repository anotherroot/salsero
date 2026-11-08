/**
 * Keep in step, through the real page actions: a save on a copy flows to its
 * family (`flowing` around the figure page's actions), and a form that was
 * open while a change flowed in cannot write the old value back (Review
 * Focus 1: `seen` is required on any row with copies, and checked).
 *
 * Ana (u1) has her own Enchufla · Basic (F) and edits Salsa Tuesdays (G1),
 * which holds its copy (G1f). The actions reach the in-memory database
 * through a mocked `getDb()`; files and the free disk are fakes.
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

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { figures, recordings, songs, users, videoSpots } from '$lib/server/db/schema';
import { createTeam } from '$lib/server/teams';
import { addRecording, createFigure, createVariationIn } from '$lib/server/figures';
import { addSpot } from '$lib/server/spots';
import { setSyncSettings } from '$lib/server/clones/sync-settings';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { cloneInto } from '$lib/server/clones/clone';
import { hasCopies } from '$lib/server/clones/genes';
import { missingSeen, variationSeen } from '$lib/server/clash';
import { crossRefs, familyIntegrity } from '$lib/server/integrity';
import { NO_FILES, T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import * as figurePage from './(moves)/figures/[id]/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as spotEndpoint from '../api/video-spots/[id]/+server';

const T = Date.UTC(2026, 10, 7, 12);
const USER = { id: 'u1', email: 'u1@x.si', timezone: 'UTC', dance: 'salsa', isAdmin: false };

let db: Db;
let F: number;
let G1f: number;

beforeEach(async () => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' })
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	F = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: 'Old notes'
	})!.figure.id;
	const copy = await cloneInto(
		db,
		{ kind: 'figure', id: F, into: T1_SALSA, recordings: false },
		NO_FILES,
		T
	);
	if (!copy.ok) throw new Error(`copy refused: ${copy.reason}`);
	G1f = copy.id;
});

/** The figure page's edit form, posted as the page posts it. */
function post(id: number, fields: Record<string, string>) {
	const body = new URLSearchParams(fields);
	return {
		params: { dance: 'salsa', id: String(id) },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body
		}),
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user: USER }
	};
}
type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const update = (event: ReturnType<typeof post>) =>
	(figurePage.actions.update as unknown as Invoke)(event);

/** What the edit form holds and posts: the row's values, then what was typed. */
function form(id: number, typed: Record<string, string>, seen: unknown = variationSeen(db, id)) {
	const r = db.select().from(figures).where(eq(figures.id, id)).get()!;
	const fields: Record<string, string> = {
		name: r.name,
		partner: r.partner,
		style: r.styleTag ?? 'salsa',
		notes: r.notes ?? '',
		startCount: String(r.startCount ?? 1),
		lengthCounts: String(r.lengthCounts ?? 8),
		...typed
	};
	if (seen !== null) fields.seen = JSON.stringify(seen);
	return fields;
}

const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;

describe('a save on a copy flows, and a form open across a flow cannot undo it', () => {
	it("a save on the club's copy reaches Ana's own (the page's actions are wrapped)", async () => {
		expect(await update(post(G1f, form(G1f, { notes: 'Club notes' })))).toMatchObject({
			ok: true
		});
		expect(row(G1f).notes).toBe('Club notes');
		expect(row(F).notes).toBe('Club notes');
		expect(crossRefs(db)).toEqual([]);
		expect(familyIntegrity(db)).toEqual([]);
	});

	it('Review Focus 1: a form open while a change flowed in is refused as a clash, notes named', async () => {
		// Ana opens her own F's edit form: this is what it saw.
		const opened = form(F, {});
		// Meanwhile the club's copy is edited and the change flows into F.
		await update(post(G1f, form(G1f, { notes: 'Club notes' })));
		expect(row(F).notes).toBe('Club notes');
		// She saves the open form, only the name changed, its notes the old ones.
		const answer = (await update(post(F, { ...opened, name: 'Basic two' }))) as {
			status: number;
			data: { clash?: { changed: string[] } };
		};
		expect(answer.status).toBe(409);
		expect(answer.data.clash?.changed).toContain('notes');
		// Nothing written: the flowed value stays, and so does the name.
		expect(row(F).notes).toBe('Club notes');
		expect(row(F).name).toBe('Basic');
	});

	it('a save on a row with copies must say what it saw; one with none need not', async () => {
		expect(hasCopies(db, 'figure', F)).toBe(true);
		const refused = (await update(post(F, form(F, { notes: 'Mine' }, null)))) as {
			status: number;
			data: { message: string };
		};
		expect(refused.status).toBe(400);
		expect(refused.data.message).toBe(missingSeen());
		expect(row(F).notes).toBe('Old notes');

		const bare = createFigure(db, U1_SALSA, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		expect(hasCopies(db, 'figure', bare)).toBe(false);
		expect(await update(post(bare, form(bare, { notes: 'Mine' }, null)))).toMatchObject({
			ok: true
		});
		expect(row(bare).notes).toBe('Mine');
	});

	it('the figure page saves other fields beside a same-named copy; typing a taken name is refused', async () => {
		// The club has another Basic (its own family); Ana takes it into her Enchufla: two Basics there.
		const clubOther = createVariationIn(
			db,
			row(G1f).groupId!,
			{ name: 'Basic 2', partner: 'partner', style: 'salsa', notes: null },
			'u1'
		)!;
		db.update(figures).set({ name: 'Basic' }).where(eq(figures.id, clubOther.id)).run();
		const second = await cloneInto(
			db,
			{ kind: 'figure', id: clubOther.id, into: U1_SALSA, recordings: false },
			NO_FILES,
			T
		);
		if (!second.ok) throw new Error(`copy refused: ${second.reason}`);
		expect(row(second.id).name).toBe('Basic');
		expect(row(second.id).groupId).toBe(row(F).groupId);
		expect(await update(post(F, form(F, { notes: 'Only notes' })))).toMatchObject({ ok: true });
		expect(row(F).notes).toBe('Only notes');
		// Another figure of the move renamed onto the taken name is still refused.
		const other = createVariationIn(
			db,
			row(F).groupId!,
			{ name: 'Doble', partner: 'partner', style: 'salsa', notes: null },
			'u1'
		)!.id;
		const refused = (await update(post(other, form(other, { name: 'basic' })))) as {
			status: number;
		};
		expect(refused.status).toBe(400);
		expect(row(other).name).toBe('Doble');
	});

	it('an archived copy is no copy', async () => {
		db.update(figures).set({ archivedAt: T }).where(eq(figures.id, G1f)).run();
		expect(hasCopies(db, 'figure', F)).toBe(false);
	});
});

describe('a flat route flows too, and asks for seen on a copy', () => {
	/** F with a recording and a section, copied into a second club's copy with both. */
	async function withSection() {
		const rec = addRecording(db, {
			figureId: F,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		})!;
		const spot = addSpot(db, { recordingId: rec.id }, { startMs: 0, endMs: 2000, label: 'Turn' })!;
		createTeam(db, 'u1', 'salsa', 'Rueda club', T);
		const copy = await cloneInto(
			db,
			{
				kind: 'figure',
				id: F,
				into: { teamId: 2, actorId: 'u1', dance: 'salsa' },
				recordings: true
			},
			NO_FILES,
			T
		);
		if (!copy.ok) throw new Error(`copy refused: ${copy.reason}`);
		return { spot: spot.id, G2f: copy.id };
	}
	const patch = (id: number, body: unknown) =>
		(spotEndpoint.PATCH as unknown as (e: unknown) => Promise<Response>)({
			params: { id: String(id) },
			request: new Request('http://localhost/', { method: 'PATCH', body: JSON.stringify(body) }),
			locals: { user: USER }
		});
	const labelsOn = (figureId: number) =>
		db
			.select({ label: videoSpots.label })
			.from(videoSpots)
			.innerJoin(recordings, eq(recordings.id, videoSpots.recordingId))
			.where(eq(recordings.figureId, figureId))
			.all()
			.map((r) => r.label);

	it("a section's rename on Ana's own flows into the club's copy that takes sections", async () => {
		const { spot, G2f } = await withSection();
		expect(labelsOn(G2f)).toEqual(['Turn']);
		setSyncSettings(db, 'u1', 'figure', G2f, { ...DEFAULT_SYNC, sections: true }, T);
		const res = await patch(spot, {
			label: 'Inside turn',
			seen: { label: 'Turn', startMs: 0, endMs: 2000 }
		});
		expect(res.status).toBe(200);
		expect(labelsOn(F)).toEqual(['Inside turn']);
		expect(labelsOn(G2f)).toEqual(['Inside turn']);
	});

	it('a section on a row with copies must say what it saw', async () => {
		const { spot } = await withSection();
		const refused = await patch(spot, { label: 'Inside turn' }).catch((e: unknown) => e);
		expect(refused).toMatchObject({ status: 400, body: { message: missingSeen() } });
		expect(labelsOn(F)).toEqual(['Turn']);
	});
});

describe("a person's own song with a copy sends seen", () => {
	const song = (o: Record<string, unknown>) =>
		db
			.insert(songs)
			.values({
				title: 'Oye',
				dance: 'salsa',
				status: 'ready',
				audioFile: `a${Math.random()}.mp3`,
				...o
			} as never)
			.returning()
			.get().id;
	const load = (id: number) =>
		(songPage.load as unknown as (e: unknown) => { seen: unknown })({
			params: { dance: 'salsa', id: String(id) },
			url: new URL(`http://localhost/salsa/songs/${id}`),
			cookies: { get: () => undefined, delete: () => {} },
			locals: { user: USER }
		});

	it('with a copy in a group, the load sends what the forms saw; alone, nothing', () => {
		const own = song({ userId: 'u1', geneId: 'g-s' });
		song({ teamId: 1, geneId: 'g-s' });
		const alone = song({ userId: 'u1', title: 'Alone' });
		expect(load(own).seen).toMatchObject({ title: 'Oye' });
		expect(load(alone).seen).toBeNull();
	});
});
