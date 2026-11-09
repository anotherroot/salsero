import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { PUSH_BATCH, type CapturedRow } from '$lib/sync/outbox';
import { migrateDevice, writeMetaValue } from './migrate';
import { repoMigrations } from './test-migrations';
import { installCapture } from './capture';
import {
	applyResults,
	discardEntry,
	forgetPerson,
	outboxItems,
	outboxSummary,
	recordEntry,
	resetSending,
	resolveEntry,
	retryEntry,
	setStates,
	toSend,
	toWire,
	type NewEntry
} from './outbox';

let db: Database.Database;
let n = 0;

beforeEach(() => {
	db = new Database(':memory:');
	migrateDevice(db, repoMigrations());
	installCapture(db);
	n = 0;
});

const S = 2 ** 32;
const body = (fields: Record<string, string>) =>
	new TextEncoder().encode(new URLSearchParams(fields).toString());

function entry(over: Partial<NewEntry> = {}): NewEntry {
	n++;
	return {
		id: `entry-${String(n).padStart(4, '0')}`,
		userId: 'u1',
		madeAt: 1000 + n,
		epoch: 12,
		cls: 'device',
		url: `/salsa/exercises/${n}?/done`,
		method: 'POST',
		headers: [['content-type', 'application/x-www-form-urlencoded']],
		body: body({ note: `n${n}` }),
		minted: {},
		rows: [],
		label: { kind: 'log', thing: 'Enchufla' },
		...over
	};
}

const states = () =>
	(
		db.prepare('SELECT id, state, held_by AS heldBy FROM outbox ORDER BY seq').all() as {
			id: string;
			state: string;
			heldBy: string | null;
		}[]
	).map((r) => [r.id, r.state, r.heldBy]);

describe('the outbox', () => {
	it('keeps entries in order and sends at most a batch', () => {
		for (let i = 0; i < PUSH_BATCH + 3; i++) recordEntry(db, entry());
		const first = toSend(db, 'u1');
		expect(first).toHaveLength(PUSH_BATCH);
		expect(first.map((e) => e.id)).toEqual([...first.map((e) => e.id)].sort());
		expect(first[0].body).toEqual(body({ note: 'n1' }));
		setStates(
			db,
			first.map((e) => e.id),
			'sending'
		);
		expect(toSend(db, 'u1')).toHaveLength(3);
		expect(toWire(first[0])).toMatchObject({
			id: first[0].id,
			url: first[0].url,
			body: expect.any(String)
		});
	});

	it('drops landed entries, keeps refused ones with their reason, and holds what depends on them', () => {
		const drill = 3 * S + 1;
		const a = entry({
			minted: { exercises: [drill] },
			rows: [{ tbl: 'exercises', key: String(drill), op: 'i', before: null, after: { id: drill } }]
		});
		const b = entry({ url: `/salsa/exercises/${drill}?/done` });
		const c = entry();
		const d = entry();
		for (const e of [a, b, c, d]) recordEntry(db, e);
		const out = applyResults(db, 'u1', [
			{
				id: a.id,
				state: 'refused',
				reason: 'gone',
				message: 'Gone',
				clash: null,
				gone: { by: null, at: null }
			},
			{ id: c.id, state: 'landed' },
			{ id: d.id, state: 'deferred' }
		]);
		expect(out).toEqual({ landed: 1 });
		expect(states()).toEqual([
			[a.id, 'refused', null],
			[b.id, 'held', a.id],
			[d.id, 'waiting', null]
		]);
		expect(toSend(db, 'u1').map((e) => e.id)).toEqual([d.id]);
	});

	it('retry sends a refused entry and its held ones again', () => {
		const a = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		const b = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		recordEntry(db, a);
		recordEntry(db, b);
		applyResults(db, 'u1', [
			{ id: a.id, state: 'refused', reason: 'clash', message: null, clash: null, gone: null }
		]);
		expect(states()).toEqual([
			[a.id, 'refused', null],
			[b.id, 'held', a.id]
		]);
		expect(retryEntry(db, 'u1', a.id)).toBe(2);
		expect(states()).toEqual([
			[a.id, 'waiting', null],
			[b.id, 'waiting', null]
		]);
	});

	it('discard removes it with its held ones and says how many', () => {
		const a = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		const b = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		const c = entry();
		for (const e of [a, b, c]) recordEntry(db, e);
		applyResults(db, 'u1', [
			{ id: a.id, state: 'refused', reason: 'clash', message: null, clash: null, gone: null }
		]);
		expect(discardEntry(db, 'u1', a.id)).toBe(2);
		expect(states()).toEqual([[c.id, 'waiting', null]]);
	});

	it('resolve (a clash settled, Mine or Theirs) drops only that entry; its held ones go again', () => {
		const a = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		const b = entry({ rows: [{ tbl: 'lessons', key: '4', op: 'u', before: null, after: null }] });
		for (const e of [a, b]) recordEntry(db, e);
		applyResults(db, 'u1', [
			{ id: a.id, state: 'refused', reason: 'clash', message: null, clash: null, gone: null }
		]);
		expect(resolveEntry(db, 'u1', a.id)).toBe(1);
		expect(states()).toEqual([[b.id, 'waiting', null]]);
	});

	it("keeps another person's entries aside: never counted, listed or sent", async () => {
		recordEntry(db, entry());
		recordEntry(db, entry({ userId: 'u4' }));
		expect(outboxSummary(db, 'u1').waiting).toBe(1);
		expect(toSend(db, 'u1')).toHaveLength(1);
		expect(await outboxItems(db, 'u1')).toHaveLength(1);
		expect(outboxSummary(db, null).waiting).toBe(0);
		forgetPerson(db, 'u1');
		expect(outboxSummary(db, 'u1').waiting).toBe(0);
		expect(outboxSummary(db, 'u4').waiting).toBe(1);
	});

	it('a sending entry goes back to waiting after a restart', () => {
		recordEntry(db, entry());
		const [e] = toSend(db, 'u1');
		setStates(db, [e.id], 'sending');
		expect(toSend(db, 'u1')).toHaveLength(0);
		resetSending(db);
		expect(toSend(db, 'u1')).toHaveLength(1);
	});

	it('marks queued things until their entry lands', () => {
		const song: CapturedRow = { tbl: 'songs', key: '42', op: 'i', before: null, after: { id: 42 } };
		const e = entry({ cls: 'queued', rows: [song], madeAt: 5000 });
		recordEntry(db, e);
		recordEntry(db, entry({ rows: [{ ...song, key: '43' }], madeAt: 6000 }));
		writeMetaValue(db, 'lastSyncedAt', '777');
		const sum = outboxSummary(db, 'u1');
		expect(sum.queued).toEqual({ 'songs:42': 5000 });
		expect(sum).toMatchObject({
			waiting: 2,
			oldestWaitingAt: 5000,
			refused: 0,
			held: 0,
			lastSyncedAt: 777,
			signedOut: false,
			epochs: [12]
		});
		expect(sum.seq).toBeGreaterThan(0);
		applyResults(db, 'u1', [{ id: e.id, state: 'landed' }]);
		expect(outboxSummary(db, 'u1').queued).toEqual({});
	});

	it("keeps seq at the newest entry ever recorded after it lands (the SW's wrote mark never drops)", () => {
		const e = entry();
		recordEntry(db, e);
		const seq = outboxSummary(db, 'u1').seq;
		expect(seq).toBeGreaterThan(0);
		applyResults(db, 'u1', [{ id: e.id, state: 'landed' }]);
		expect(outboxSummary(db, 'u1')).toMatchObject({ waiting: 0, seq });
	});

	it('lists an entry with its label, reason and what was typed', async () => {
		const e = entry({ body: body({ note: 'from the studio', seen: '{}' }) });
		recordEntry(db, e);
		applyResults(db, 'u1', [
			{
				id: e.id,
				state: 'refused',
				reason: 'gone',
				message: 'It was archived',
				clash: null,
				gone: { by: 'Luka', at: 9 }
			}
		]);
		const [item] = await outboxItems(db, 'u1');
		expect(item).toMatchObject({
			id: e.id,
			state: 'refused',
			label: { kind: 'log', thing: 'Enchufla' },
			reason: 'gone',
			message: 'It was archived',
			gone: { by: 'Luka', at: 9 },
			heldBy: null,
			dependents: 0,
			fields: [['note', 'from the studio']]
		});
	});
});
