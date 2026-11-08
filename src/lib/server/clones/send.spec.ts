/**
 * Copies you can see (board C3), the Versions list's family: u1's own
 * Enchufla · Doble is the hub, copied into Salsa Tuesdays (T1, u1 owns it)
 * and Rueda club (T2, Maja's; u1 and Nik edit it). (Send mine is Sync now:
 * `sync.spec.ts`.) Files are fakes; the database is in memory.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { figures, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { addRecording, createFigure, updateVariation } from '../figures';
import { createLesson, linkFigure, publishLesson } from '../lessons';
import { insertFixturePositions } from '../test-positions';
import type { Space, TeamSpace } from '../scope';
import { T1_SALSA, T2_SALSA, U1_SALSA } from '../test-walls';
import { geneOf } from './genes';
import { cloneInto } from './clone';
import type { CloneFileKind, CloneFiles } from './files';
import { familyStatus, familyView } from './send';

const T = Date.UTC(2026, 10, 3, 20);
const shape = { partner: 'partner' as const, style: 'salsa', notes: null };
const T3_SALSA: TeamSpace = { teamId: 3, actorId: 'u3', dance: 'salsa' };

let db: Db;
/** Every linked name is new, as a real link's is. */
let named = 0;

beforeEach(() => {
	db = openDb(':memory:');
	insertFixturePositions(db);
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

	it('a member u1 only reads is listed, not editable', async () => {
		const { H, T2f } = await threePlaces();
		const T3f = await sonClub(T2f);
		const son = familyStatus(db, 'u1', 'figure', H).find((e) => e.member.id === T3f)!;
		expect(son).toMatchObject({ role: 'member', editable: false });
	});

	it('a member who edits nothing sees no family list', async () => {
		const { T1f } = await threePlaces();
		// u2 is a member of T1: reads nothing there unpublished, edits nothing.
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
		expect(familyView(db, 'u1', 'figure', H)).toEqual({
			entries: familyStatus(db, 'u1', 'figure', H)
		});
	});
});
