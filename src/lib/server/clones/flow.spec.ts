/**
 * Keep in step, the flow after a save (`flowFrom`). Ana (u1) has her own
 * Enchufla · Basic (F), copied into Salsa Tuesdays (G1) and Rueda club (G2),
 * both hers. Luka (u2) is a plain member of G1, reads G1's copy through a
 * published lesson, and made it his own (F2, Make it mine). Files are fakes;
 * the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import {
	cloneMarks,
	figures,
	links,
	recordings,
	teamChanges,
	users,
	videoSpots
} from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addLinks, deleteLink } from '../links';
import { addSpot, deleteSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { crossRefs, familyIntegrity } from '../integrity';
import type { Space } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA, U2_SALSA } from '../test-walls';
import type { SyncSettings } from '$lib/types';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import { initialBase } from '$lib/clones/diff';
import { cloneInto } from './clone';
import { makeMine } from './edit';
import type { CloneFiles } from './files';
import { hashValue, writePair } from './pairs';
import { flatOf } from './trees';
import { markNow, readMark } from './marks';
import { setSyncSettings } from './sync-settings';
import { flowFrom } from './flow';
import { landKeys } from './apply';

const T = Date.UTC(2026, 10, 7, 12);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const URL_A = 'https://example.org/a';

let db: Db;
let named = 0;
let linkedFiles: string[] = [];
/** Runs once while a file is being linked: a save landing mid-hop. */
let whileLinking: (() => void) | null = null;

const files: CloneFiles = {
	async link(_kind, file) {
		linkedFiles.push(file);
		await Promise.resolve();
		const during = whileLinking;
		whileLinking = null;
		during?.();
		return `copy-${++named}-${file}`;
	},
	async unlink() {}
};

let F: number;
let G1f: number;
let G2f: number;
let F2: number;

async function copy(id: number, into: Space) {
	const r = await cloneInto(db, { kind: 'figure', id, into, recordings: false }, files, T);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

beforeEach(async () => {
	db = openDb(':memory:');
	linkedFiles = [];
	whileLinking = null;
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u1', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	F = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: 'Old notes'
	})!.figure.id;
	addLinks(db, { figureId: F }, [URL_A], null);
	G1f = await copy(F, T1_SALSA);
	G2f = await copy(F, T2_SALSA);
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-04', title: 'Week 1', notes: null })
		.lesson.id;
	expect(linkFigure(db, L, G1f, 'u1')).toBe(true);
	expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
	const mine = await makeMine(db, U2_SALSA, 'figure', G1f, files, T, ROOMY);
	if (!mine.ok) throw new Error(`make it mine refused: ${mine.reason}`);
	F2 = mine.id;
	expect(crossRefs(db)).toEqual([]);
});

const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const recsOn = (id: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, id)).all();
const linksOn = (id: number) =>
	db
		.select({ url: links.url })
		.from(links)
		.where(eq(links.figureId, id))
		.all()
		.map((l) => l.url);
const changesIn = (teamId: number) =>
	db
		.select()
		.from(teamChanges)
		.where(eq(teamChanges.teamId, teamId))
		.orderBy(asc(teamChanges.id))
		.all();

/** A save of the edit form: name, partner, style and notes. */
function save(id: number, patch: { name?: string; notes?: string | null }, by = 'u1') {
	const r = row(id);
	const ok = updateVariation(
		db,
		id,
		{
			name: patch.name ?? r.name,
			partner: r.partner as 'partner',
			style: r.styleTag ?? 'salsa',
			notes: patch.notes === undefined ? r.notes : patch.notes
		},
		by
	);
	expect(ok).not.toBeNull();
}
const setStart = (id: number, startCount: number) =>
	db.update(figures).set({ startCount }).where(eq(figures.id, id)).run();
const flow = (actor: string, id: number) => flowFrom(db, actor, 'figure', id, files, NOW, ROOMY);
const settings = (actor: string, id: number, s: Partial<SyncSettings>) =>
	expect(setSyncSettings(db, actor, 'figure', id, { ...DEFAULT_SYNC, ...s }, T)).toBe(true);
const recording = (figureId: number, file: string) =>
	addRecording(db, { figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes: 50, note: null })
		.id;

describe('flowFrom', () => {
	it('option A: only what this save changed flows; an older difference stays', async () => {
		// F's timing changed and was marked (a save before deploy): an old difference.
		setStart(F, 3);
		markNow(db, 'figure', F, T);
		save(F, { notes: 'Hips first' });
		const report = await flow('u1', F);
		expect(report.refused).toEqual([]);
		expect(report.landed).toContain(G1f);
		expect(row(G1f)).toMatchObject({ notes: 'Hips first', startCount: 1 });
		expect(row(G2f)).toMatchObject({ notes: 'Hips first', startCount: 1 });
		expect(row(F)).toMatchObject({ startCount: 3 });
	});

	it('a save with no mark marks the row and flows nothing', async () => {
		const own = createFigure(db, U1_SALSA, {
			figureName: 'Dile',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const copyOf = await copy(own, T1_SALSA);
		db.delete(cloneMarks).run();
		save(own, { notes: 'New' });
		expect(await flow('u1', own)).toEqual({ landed: [], refused: [] });
		expect(readMark(db, 'figure', own)).not.toBeNull();
		expect(row(copyOf).notes).toBeNull();
		// The next save flows.
		save(own, { notes: 'Newer' });
		expect((await flow('u1', own)).landed).toEqual([copyOf]);
		expect(row(copyOf).notes).toBe('Newer');
	});

	it('both changed: a field the receiver changed since the snapshot stays', async () => {
		save(G1f, { notes: 'Club notes' });
		save(F, { notes: 'Ana notes' });
		const report = await flow('u1', F);
		expect(row(G1f).notes).toBe('Club notes');
		expect(row(G2f).notes).toBe('Ana notes');
		expect(report.landed).not.toContain(G1f);
		expect(report.landed).toContain(G2f);
	});

	it('chain: F → G1 → Luka’s F2, and G2; each written once', async () => {
		const before = [changesIn(1).length, changesIn(2).length];
		save(F, { notes: 'Hips first' });
		const report = await flow('u1', F);
		expect(report).toEqual({ landed: [G1f, G2f, F2], refused: [] });
		for (const id of [F, G1f, G2f, F2]) expect(row(id).notes).toBe('Hips first');
		expect(changesIn(1).length - before[0]).toBe(1);
		expect(changesIn(2).length - before[1]).toBe(1);
	});

	it('chain: the clubs’ copies paired too, still each written once', async () => {
		writePair(db, 'figure', G1f, G2f, initialBase(flatOf(db, 'figure', G1f), [], hashValue), T);
		const before = changesIn(2).length;
		save(F, { notes: 'Hips first' });
		const report = await flow('u1', F);
		expect([...report.landed].sort()).toEqual([G1f, G2f, F2].sort());
		expect(new Set(report.landed).size).toBe(report.landed.length);
		expect(changesIn(2).length - before).toBe(1);
	});

	it('no ping-pong: after the flow nothing comes back', async () => {
		save(F, { notes: 'Hips first' });
		await flow('u1', F);
		const lines = db.select().from(teamChanges).all().length;
		const flats = [F, G1f, G2f, F2].map((id) => flatOf(db, 'figure', id));
		expect(await flow('u1', G1f)).toEqual({ landed: [], refused: [] });
		expect(await flow('u1', G2f)).toEqual({ landed: [], refused: [] });
		expect(await flow('u2', F2)).toEqual({ landed: [], refused: [] });
		expect(await flow('u1', F)).toEqual({ landed: [], refused: [] });
		expect([F, G1f, G2f, F2].map((id) => flatOf(db, 'figure', id))).toEqual(flats);
		expect(db.select().from(teamChanges).all().length).toBe(lines);
	});

	it('reader pulls only: Luka’s edit never reaches the club', async () => {
		save(F2, { notes: 'Luka notes' }, 'u2');
		expect(await flow('u2', F2)).toEqual({ landed: [], refused: [] });
		expect(row(G1f).notes).toBe('Old notes');
		// The club's next edit reaches him only on fields he did not change.
		save(F, { notes: 'Hips first' });
		setStart(F, 5);
		const report = await flow('u1', F);
		expect(report.landed).toContain(F2);
		expect(row(G1f)).toMatchObject({ notes: 'Hips first', startCount: 5 });
		expect(row(F2)).toMatchObject({ notes: 'Luka notes', startCount: 5 });
	});

	it('switch off: an off receiver is skipped; an off saver sends nothing', async () => {
		settings('u2', F2, { on: false });
		save(F, { notes: 'One' });
		const one = await flow('u1', F);
		expect(one.landed).toEqual([G1f, G2f]);
		expect(row(F2).notes).toBe('Old notes');

		settings('u1', F, { on: false });
		save(F, { notes: 'Two' });
		expect(await flow('u1', F)).toEqual({ landed: [], refused: [] });
		expect(row(G1f).notes).toBe('One');
		// Back on: nothing flows backwards in time; only the next save's change.
		settings('u1', F, { on: true });
		setStart(F, 3);
		const three = await flow('u1', F);
		expect(three.landed).toEqual([G1f, G2f]);
		expect(row(G1f)).toMatchObject({ notes: 'One', startCount: 3 });
	});

	it('options: a link removal flows (small removals on)', async () => {
		const linkId = db.select().from(links).where(eq(links.figureId, F)).get()!.id;
		expect(deleteLink(db, { figureId: F }, linkId)).toBe(true);
		await flow('u1', F);
		expect(linksOn(G1f)).toEqual([]);
		expect(linksOn(G2f)).toEqual([]);
		expect(linksOn(F2)).toEqual([]);
	});

	it('options: small removals off keeps the link', async () => {
		settings('u1', G1f, { small: false });
		const linkId = db.select().from(links).where(eq(links.figureId, F)).get()!.id;
		expect(deleteLink(db, { figureId: F }, linkId)).toBe(true);
		await flow('u1', F);
		expect(linksOn(G1f)).toEqual([URL_A]);
		expect(linksOn(G2f)).toEqual([]);
	});

	it('options: a recording flows only into a copy with media on, and only from its save', async () => {
		recording(F, 'a.mp4');
		const one = await flow('u1', F);
		expect(one).toEqual({ landed: [], refused: [] });
		expect(recsOn(G1f)).toHaveLength(0);

		settings('u1', G1f, { media: true });
		recording(F, 'b.mp4');
		const two = await flow('u1', F);
		expect(two).toEqual({ landed: [G1f], refused: [] });
		expect(linkedFiles).toEqual(['b.mp4']);
		expect(recsOn(G1f).map((r) => r.file)).toEqual([`copy-${named}-b.mp4`]);
		expect(recsOn(G2f)).toHaveLength(0);
		expect(recsOn(F2)).toHaveLength(0);

		// G2 takes media from now on: b.mp4 was an earlier save, it does not ride along.
		settings('u1', G2f, { media: true });
		save(F, { notes: 'Later' });
		const three = await flow('u1', F);
		expect(three.landed).toContain(G2f);
		expect(row(G2f).notes).toBe('Later');
		expect(recsOn(G2f)).toHaveLength(0);
		expect(familyIntegrity(db)).toEqual([]);
	});

	it('options: a new recording reaches both clubs, though the first hop stamped its gene', async () => {
		settings('u1', G1f, { media: true });
		settings('u1', G2f, { media: true });
		recording(F, 'b.mp4');
		expect(await flow('u1', F)).toEqual({ landed: [G1f, G2f], refused: [] });
		expect(recsOn(G1f)).toHaveLength(1);
		expect(recsOn(G2f)).toHaveLength(1);
		expect(familyIntegrity(db)).toEqual([]);
	});

	it('option A: a recording stamped by a Send outside the flow does not ride a later save', async () => {
		const rec = recording(F, 'a.mp4');
		expect(await flow('u1', F)).toEqual({ landed: [], refused: [] });
		// Send it to G1 by hand: the copy stamps the recording's gene on F.
		const sent = await landKeys(db, {
			actorId: 'u1',
			kind: 'figure',
			intoId: G1f,
			fromId: F,
			keys: [`rec:#${rec}`],
			snapshot: 'full',
			files,
			now: NOW,
			freeDiskBytes: ROOMY
		});
		expect(sent).toEqual({ ok: true });
		expect(recsOn(G1f)).toHaveLength(1);
		settings('u1', G2f, { media: true });
		save(F, { notes: 'Later' });
		const report = await flow('u1', F);
		expect(report.landed).toContain(G2f);
		expect(row(G2f).notes).toBe('Later');
		expect(recsOn(G2f)).toHaveLength(0);
	});

	it('a save on the receiver while a hop links its files: the hop is refused as stale', async () => {
		settings('u1', G1f, { media: true });
		recording(F, 'b.mp4');
		save(F, { notes: 'Hips first' });
		whileLinking = () => save(G1f, { notes: 'Club edit' });
		const report = await flow('u1', F);
		expect(report.refused).toEqual([{ id: G1f, reason: 'stale' }]);
		expect(row(G1f).notes).toBe('Club edit');
		expect(recsOn(G1f)).toHaveLength(0);
		expect(report.landed).toContain(G2f);
		expect(row(G2f).notes).toBe('Hips first');
	});

	it('suffix: a rename that only adds a copy’s suffix is never pushed', async () => {
		save(F, { name: 'Basic (Sreda 17:30)', notes: 'Hips first' });
		await flow('u1', F);
		expect(row(G1f)).toMatchObject({ name: 'Basic', notes: 'Hips first' });
		expect(row(G2f)).toMatchObject({ name: 'Basic', notes: 'Hips first' });
		// A real rename does travel (names on).
		save(F, { name: 'Doble' });
		await flow('u1', F);
		expect(row(G1f).name).toBe('Doble');
	});

	it('refused hop: a section removal meeting a linked section is skipped alone', async () => {
		for (const id of [G1f, G2f]) settings('u1', id, { media: true, sections: true });
		const rec = recording(F, 'r.mp4');
		const spot = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 4000, label: 'Turn' })!.id;
		await flow('u1', F);
		const spotOf = (figureId: number) =>
			db
				.select({ id: videoSpots.id })
				.from(videoSpots)
				.innerJoin(recordings, eq(recordings.id, videoSpots.recordingId))
				.where(and(eq(recordings.figureId, figureId)))
				.get()?.id;
		const g1Spot = spotOf(G1f)!;
		expect(spotOf(G2f)).toBeDefined();
		linkInSpace(db, T1_SALSA, g1Spot, { figureId: G1f });

		deleteSpot(db, spot);
		save(F, { notes: 'Hips first' });
		const report = await flow('u1', F);
		expect(report.refused).toEqual([{ id: G1f, reason: 'linked' }]);
		expect(report.landed).toEqual([G2f]);
		expect(spotOf(G1f)).toBe(g1Spot);
		expect(row(G1f).notes).toBe('Old notes');
		expect(spotOf(G2f)).toBeUndefined();
		expect(row(G2f).notes).toBe('Hips first');
		// G1 was refused, so nothing went on from it to Luka.
		expect(row(F2).notes).toBe('Old notes');
	});

	it('history: one change by the saver in each club; integrity holds', async () => {
		const before = changesIn(1).length;
		save(F, { notes: 'Hips first' });
		await flow('u1', F);
		const lines = changesIn(1).slice(before);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ verb: 'change', actorId: 'u1', rootKind: 'figure' });
		expect(crossRefs(db)).toEqual([]);
		expect(familyIntegrity(db)).toEqual([]);
	});

	it('nobody else’s save: an actor who cannot edit the row flows nothing', async () => {
		save(F, { notes: 'Hips first' });
		expect(await flow('u2', F)).toEqual({ landed: [], refused: [] });
		expect(row(G1f).notes).toBe('Old notes');
	});
});
