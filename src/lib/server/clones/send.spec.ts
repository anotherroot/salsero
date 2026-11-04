/**
 * Copies you can see, and Send mine (board C3): u1's own Enchufla · Doble is
 * the hub, copied into Salsa Tuesdays (T1, u1 owns it) and Rueda club (T2,
 * Maja's; u1 and Nik edit it). Send writes u1's changes into each target u1
 * edits, each in its own transaction, from the target's side: what only u1
 * changed lands, what only the target changed stays, a delete only when
 * ticked. Files are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, recordings, teamChanges, users, videoSpots } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createCustomExercise } from '../exercises';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { addSpot, deleteSpot } from '../spots';
import { linkInSpace } from '../spot-links';
import { seedPositions } from '../test-positions';
import type { Space, TeamSpace } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA } from '../test-walls';
import type { Picks } from '$lib/types';
import { geneOf } from './genes';
import { cloneInto } from './clone';
import type { CloneFileKind, CloneFiles } from './files';
import { compareWith, takeTheirs } from './compare';
import { familyStatus, familyView, sendMine, sendPreview } from './send';

const T = Date.UTC(2026, 10, 3, 20);
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const T3_SALSA: TeamSpace = { teamId: 3, actorId: 'u3', dance: 'salsa' };

let db: Db;
/** Every linked name is new, as a real link's is. */
let named = 0;

beforeEach(() => {
	db = openDb(':memory:');
	seedPositions(db);
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', firstName: 'Ana' },
			{ id: 'u2', email: 'u2@x.si', passwordHash: 'x', firstName: 'Luka' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x', firstName: 'Maja' },
			{ id: 'u4', email: 'u4@x.si', passwordHash: 'x', firstName: 'Nik' }
		])
		.run();
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u3', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u2', 1, T);
	for (const u of ['u1', 'u4']) {
		joinTeam(db, u, 2, T);
		setRole(db, 2, u, 'editor', T);
	}
});

function fakeFiles() {
	const linked: [CloneFileKind, string][] = [];
	const files: CloneFiles = {
		async link(kind, file) {
			linked.push([kind, file]);
			return `copy-${++named}-${file}`;
		},
		async unlink() {}
	};
	return { files, linked };
}

const recording = (figureId: number, file: string, note: string | null = null) =>
	addRecording(db, { figureId, file, mime: 'video/mp4', kind: 'video', sizeBytes: 50, note }, 'u1')
		.id;

async function copy(id: number, into: Space, recordings = false) {
	const r = await cloneInto(db, { kind: 'figure', id, into, recordings }, fakeFiles().files, T);
	if (!r.ok) throw new Error(`copy refused: ${r.reason}`);
	return r.id;
}

const row = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
const recsOn = (id: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, id)).all();
const changesIn = (teamId: number) =>
	db.select().from(teamChanges).where(eq(teamChanges.teamId, teamId)).all();

/** What each target would get, from its own side: [key, who changed it], and the default picks. */
const shown = (targets: ReturnType<typeof sendPreview>) =>
	targets.map((t) => ({
		id: t.target.id,
		diffs: t.comparison.diffs.map((d) => [d.key, d.side]),
		picks: t.comparison.picks
	}));

const asSent = (targets: ReturnType<typeof sendPreview>, extra: Picks = {}) =>
	targets.map((t) => ({
		id: t.target.id,
		picks: { ...t.comparison.picks, ...extra },
		seen: t.comparison.seen
	}));

/**
 * The three places: H (u1's own), its copies T1f and T2f. Since the copies,
 * Nik moved T2's timing; u1 rewrote the notes and added a recording.
 */
async function threePlaces() {
	const H = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!.figure
		.id;
	const T1f = await copy(H, T1_SALSA);
	const T2f = await copy(H, T2_SALSA);
	db.update(figures).set({ startCount: 3 }).where(eq(figures.id, T2f)).run(); // Nik
	updateVariation(db, H, { name: 'Doble', ...shape, notes: 'Hips first' });
	const rec = recording(H, 'new.mp4');
	const recKey = `rec:${geneOf(db, 'recording', rec) ?? `#${rec}`}`;
	return { H, T1f, T2f, recKey };
}

describe('three places (Review Focus 1)', () => {
	it('sendPreview: both get the notes and the recording; T2’s own timing shows but is not sent', async () => {
		const { H, T1f, T2f, recKey } = await threePlaces();
		const targets = sendPreview(db, 'u1', 'figure', H);
		// Yours first, then groups by name: Rueda club, Salsa Tuesdays.
		expect(shown(targets)).toEqual([
			{
				id: T2f,
				diffs: [
					['notes', 'theirs'],
					['timing', 'mine'],
					[recKey, 'theirs']
				],
				picks: { notes: 'theirs', timing: 'mine', [recKey]: 'theirs' }
			},
			{
				id: T1f,
				diffs: [
					['notes', 'theirs'],
					[recKey, 'theirs']
				],
				picks: { notes: 'theirs', [recKey]: 'theirs' }
			}
		]);
		expect(targets.map((t) => [t.bytes, t.removals, t.both])).toEqual([
			[50, [], []],
			[50, [], []]
		]);
		expect(targets.every((t) => t.comparison.canTake && t.comparison.canSend)).toBe(true);
	});

	it('sendMine lands the notes and the recording in both; T2 keeps Nik’s timing; one `change` each by u1', async () => {
		const { H, T1f, T2f } = await threePlaces();
		const before = [changesIn(1).length, changesIn(2).length];
		const { files, linked } = fakeFiles();
		const res = await sendMine(
			db,
			'u1',
			'figure',
			H,
			asSent(sendPreview(db, 'u1', 'figure', H)),
			files,
			NOW,
			ROOMY
		);
		expect(res).toEqual([
			{ id: T2f, result: { ok: true } },
			{ id: T1f, result: { ok: true } }
		]);
		expect(linked).toEqual([
			['recording', 'new.mp4'],
			['recording', 'new.mp4']
		]);
		expect(row(T1f)).toMatchObject({ notes: 'Hips first', startCount: 1 });
		expect(row(T2f)).toMatchObject({ notes: 'Hips first', startCount: 3 });
		expect(recsOn(T1f)).toHaveLength(1);
		expect(recsOn(T2f)).toHaveLength(1);
		for (const [i, teamId] of [1, 2].entries()) {
			const lines = changesIn(teamId).slice(before[i]);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatchObject({ verb: 'change', actorId: 'u1', rootKind: 'figure' });
		}
		// In step with u1 now, but for Nik's timing, which reads as T2's own.
		expect(shown(sendPreview(db, 'u1', 'figure', H))).toEqual([
			{ id: T2f, diffs: [['timing', 'mine']], picks: { timing: 'mine' } },
			{ id: T1f, diffs: [], picks: {} }
		]);
	});

	it('then u1 takes T2’s timing into the hub: a later send offers it to T1', async () => {
		const { H, T1f, T2f } = await threePlaces();
		await sendMine(
			db,
			'u1',
			'figure',
			H,
			asSent(sendPreview(db, 'u1', 'figure', H)),
			fakeFiles().files,
			NOW,
			ROOMY
		);
		const c = compareWith(db, 'u1', 'figure', H, T2f)!;
		expect(c.diffs.map((d) => [d.key, d.side])).toEqual([['timing', 'theirs']]);
		expect(
			await takeTheirs(db, 'u1', 'figure', H, T2f, c.picks, c.seen, fakeFiles().files, NOW, ROOMY)
		).toEqual({ ok: true });

		expect(shown(sendPreview(db, 'u1', 'figure', H))).toEqual([
			{ id: T2f, diffs: [], picks: {} },
			{ id: T1f, diffs: [['timing', 'theirs']], picks: { timing: 'theirs' } }
		]);
		await sendMine(
			db,
			'u1',
			'figure',
			H,
			asSent(sendPreview(db, 'u1', 'figure', H)),
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(row(T1f).startCount).toBe(3);
	});

	it('a pair never in step asks for every difference: unsent until picked', async () => {
		const { H, T1f } = await threePlaces();
		// From T1's figure: the hub (paired with it by the copy) and T2's, never in step with it.
		const targets = sendPreview(db, 'u1', 'figure', T1f);
		expect(targets.map((t) => t.target.id)[0]).toBe(H);
		expect(targets[0].comparison.synced).toBe(true);
		const t2 = targets.find((t) => t.target.place.kind === 'team')!;
		expect(t2.comparison.synced).toBe(false);
		expect(t2.both.map((d) => d.key)).toEqual(['timing']);
		expect(t2.comparison.picks).toEqual({});
		const res = await sendMine(
			db,
			'u1',
			'figure',
			T1f,
			[{ id: t2.target.id, picks: {}, seen: t2.comparison.seen }],
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res[0].result).toMatchObject({ ok: false, reason: 'pick' });
	});
});

describe('one target’s failure', () => {
	it('a throw in one target is its own refusal: the next still lands, with its History line', async () => {
		const { H, T1f, T2f } = await threePlaces();
		const targets = sendPreview(db, 'u1', 'figure', H);
		expect(targets.map((t) => t.target.id)).toEqual([T2f, T1f]);
		const before = changesIn(1).length;
		let calls = 0;
		const files: CloneFiles = {
			async link(_kind, file) {
				// The first target's link fails, as a missing giver file would.
				if (++calls === 1) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
				return `copy-${++named}-${file}`;
			},
			async unlink() {}
		};
		const res = await sendMine(db, 'u1', 'figure', H, asSent(targets), files, NOW, ROOMY);
		expect(res).toEqual([
			{
				id: T2f,
				result: { ok: false, reason: 'failed', message: 'That could not be sent. Try again.' }
			},
			{ id: T1f, result: { ok: true } }
		]);
		expect(row(T2f).notes).toBeNull();
		expect(row(T1f).notes).toBe('Hips first');
		expect(recsOn(T1f)).toHaveLength(1);
		expect(changesIn(1).slice(before)).toMatchObject([{ verb: 'change', actorId: 'u1' }]);
	});
});

describe('names', () => {
	it('a name both sides changed keeps the target’s and is not asked', async () => {
		const { H, T1f } = await threePlaces();
		db.update(figures).set({ name: 'Doble (Salsa Tuesdays)' }).where(eq(figures.id, T1f)).run();
		updateVariation(db, H, { name: 'Doble larga', ...shape, notes: 'Hips first' });
		const t1 = sendPreview(db, 'u1', 'figure', H).find((t) => t.target.id === T1f)!;
		expect(t1.comparison.diffs.find((d) => d.key === 'name')).toMatchObject({ side: 'both' });
		expect(t1.comparison.picks.name).toBe('mine');
		expect(t1.both).toEqual([]);
		const [res] = await sendMine(
			db,
			'u1',
			'figure',
			H,
			[{ id: T1f, picks: t1.comparison.picks, seen: t1.comparison.seen }],
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res.result).toEqual({ ok: true });
		expect(row(T1f)).toMatchObject({ name: 'Doble (Salsa Tuesdays)', notes: 'Hips first' });
	});
});

describe('removals', () => {
	it('a ticked delete of a section T1 links is refused for T1 only; T2’s send still lands', async () => {
		const H = createFigure(db, U1_SALSA, { figureName: 'Enchufla', name: 'Doble', ...shape })!
			.figure.id;
		const rec = recording(H, 'take.mp4', 'old take');
		const spot = addSpot(
			db,
			{ recordingId: rec },
			{ startMs: 1000, endMs: 2000, label: 'Turn' },
			'u1'
		)!.id;
		const T1f = await copy(H, T1_SALSA, true);
		const T2f = await copy(H, T2_SALSA, true);
		const spotOn = (figureId: number) =>
			db
				.select({ id: videoSpots.id })
				.from(videoSpots)
				.innerJoin(recordings, eq(recordings.id, videoSpots.recordingId))
				.where(and(eq(recordings.figureId, figureId)))
				.all();
		const [t1Spot] = spotOn(T1f);
		const D = createCustomExercise(db, T1_SALSA, { name: 'Shines', everyDays: 3, notes: null }).id;
		linkInSpace(db, T1_SALSA, t1Spot.id, { exerciseId: D });
		deleteSpot(db, spot, 'u1', T);

		const targets = sendPreview(db, 'u1', 'figure', H);
		const [key] = targets[0].removals.map((d) => d.key);
		expect(key).toMatch(/^rec:.+:spot:.+$/);
		expect(targets.map((t) => t.removals.map((d) => d.key))).toEqual([[key], [key]]);
		// Never preselected.
		expect(targets.map((t) => t.comparison.picks[key])).toEqual(['mine', 'mine']);
		const before = [changesIn(1).length, changesIn(2).length];

		const res = await sendMine(
			db,
			'u1',
			'figure',
			H,
			asSent(targets, { [key]: 'theirs' }),
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res.map((r) => [r.id, r.result.ok])).toEqual([
			[T2f, true],
			[T1f, false]
		]);
		expect(res[1].result).toMatchObject({ reason: 'linked' });
		expect(spotOn(T2f)).toEqual([]);
		expect(spotOn(T1f)).toHaveLength(1);
		expect(changesIn(1).length).toBe(before[0]);
		expect(
			changesIn(2)
				.slice(before[1])
				.filter((c) => c.verb === 'change')
		).toHaveLength(1);
	});
});

describe('privacy and the family list', () => {
	/** Son club (T3, Maja's), where u1 is a member: a copy of T2's, published, so u1 reads it. */
	async function sonClub(T2f: number) {
		createTeam(db, 'u3', 'salsa', 'Son club', T);
		joinTeam(db, 'u1', 3, T);
		const T3f = await copy(T2f, T3_SALSA);
		const lesson = createLesson(db, T3_SALSA, {
			lessonDay: '2026-11-01',
			title: 'Week 1',
			notes: null
		}).lesson.id;
		linkFigure(db, lesson, T3f, 'u3');
		publishLesson(db, T3_SALSA, lesson, T);
		return T3f;
	}

	it('a member u1 only reads is listed, not editable, and never a target', async () => {
		const { H, T1f, T2f } = await threePlaces();
		const T3f = await sonClub(T2f);
		expect(sendPreview(db, 'u1', 'figure', H).map((t) => t.target.id)).toEqual([T2f, T1f]);
		const res = await sendMine(
			db,
			'u1',
			'figure',
			H,
			[
				{ id: T3f, picks: { notes: 'theirs' }, seen: compareWith(db, 'u1', 'figure', T3f, H)!.seen }
			],
			fakeFiles().files,
			NOW,
			ROOMY
		);
		expect(res).toEqual([{ id: T3f, result: expect.objectContaining({ reason: 'denied' }) }]);
		expect(row(T3f).notes).toBeNull();
		const son = familyStatus(db, 'u1', 'figure', H).find((e) => e.member.id === T3f)!;
		expect(son).toMatchObject({ role: 'member', editable: false });
	});

	it('nobody sends from a row they only read; a member sees no targets', async () => {
		const { T1f } = await threePlaces();
		// u2 is a member of T1: reads nothing there unpublished, edits nothing.
		expect(sendPreview(db, 'u2', 'figure', T1f)).toEqual([]);
		expect(familyView(db, 'u2', 'figure', T1f)).toBeNull();
	});

	it('the board’s list: this one first, then Rueda club differs, Salsa Tuesdays behind', async () => {
		const { H, T1f, T2f } = await threePlaces();
		expect(
			familyStatus(db, 'u1', 'figure', H).map((e) => [
				e.member.id,
				e.role,
				e.status,
				e.changed,
				e.theirs,
				e.editable
			])
		).toEqual([
			[H, null, null, ['Notes', '+1 recording'], [], true],
			[T2f, 'editor', 'differs', ['Notes', 'Timing', '1 recording'], ['Timing'], true],
			[T1f, 'owner', 'behind', ['Notes', '1 recording'], [], true]
		]);
		expect(familyView(db, 'u1', 'figure', H)).toMatchObject({
			canSend: true,
			banners: [{ id: T2f, place: 'Rueda club', changed: ['Timing'] }]
		});
	});
});
