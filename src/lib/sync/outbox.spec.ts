import { describe, expect, it } from 'vitest';
import {
	base64Of,
	bodyFields,
	bytesOf,
	dependsOn,
	entryLabel,
	foldCaptured,
	heldBy,
	mintedIn,
	queuedMarks,
	type CapturedRow,
	type DepEntry
} from './outbox';

const S = 2 ** 32;
const row = (over: Partial<CapturedRow> & { tbl: string; key: string }): CapturedRow => ({
	op: 'u',
	before: null,
	after: null,
	...over
});
const dep = (id: string, over: Partial<DepEntry> = {}): DepEntry => ({
	id,
	url: '/salsa',
	rows: [],
	minted: {},
	...over
});

describe('folding what an entry wrote', () => {
	it('folds an insert and an update into one insert with the last after', () => {
		const out = foldCaptured([
			row({ tbl: 'sets', key: '7', op: 'i', after: { id: 7, note: 'a' } }),
			row({
				tbl: 'sets',
				key: '7',
				op: 'u',
				before: { id: 7, note: 'a' },
				after: { id: 7, note: 'b' }
			})
		]);
		expect(out).toEqual([
			row({ tbl: 'sets', key: '7', op: 'i', before: null, after: { id: 7, note: 'b' } })
		]);
	});

	it('drops a row inserted and deleted in one entry', () => {
		expect(
			foldCaptured([
				row({ tbl: 'sets', key: '7', op: 'i', after: { id: 7 } }),
				row({
					tbl: 'links',
					key: '2',
					op: 'u',
					before: { id: 2, title: 'a' },
					after: { id: 2, title: 'b' }
				}),
				row({ tbl: 'sets', key: '7', op: 'd', before: { id: 7 } })
			])
		).toEqual([
			row({
				tbl: 'links',
				key: '2',
				op: 'u',
				before: { id: 2, title: 'a' },
				after: { id: 2, title: 'b' }
			})
		]);
	});

	it('keeps an update then a delete as a delete, a delete then an insert as an update', () => {
		const a = { id: 3, n: 1 };
		const b = { id: 3, n: 2 };
		expect(
			foldCaptured([
				row({ tbl: 'sets', key: '3', op: 'u', before: a, after: b }),
				row({ tbl: 'sets', key: '3', op: 'd', before: b })
			])
		).toEqual([row({ tbl: 'sets', key: '3', op: 'd', before: a, after: null })]);
		expect(
			foldCaptured([
				row({ tbl: 'sets', key: '3', op: 'd', before: a }),
				row({ tbl: 'sets', key: '3', op: 'i', after: b })
			])
		).toEqual([row({ tbl: 'sets', key: '3', op: 'u', before: a, after: b })]);
	});

	it("lists the ids minted in the device's slot above its marks, in order", () => {
		const rows = [
			row({ tbl: 'sets', key: String(3 * S + 9), op: 'i', after: { id: 3 * S + 9 } }),
			row({ tbl: 'sets', key: String(3 * S + 10), op: 'i', after: { id: 3 * S + 10 } }),
			// restored with its own lower id: not minted now
			row({ tbl: 'sets', key: String(3 * S + 2), op: 'i', after: { id: 3 * S + 2 } }),
			// the server's slot: not ours
			row({ tbl: 'links', key: '5', op: 'i', after: { id: 5 } }),
			// a composite key: never minted
			row({ tbl: 'lesson_figures', key: '[1,2]', op: 'i', after: { lesson_id: 1, figure_id: 2 } })
		];
		expect(mintedIn(rows, 3, { sets: 3 * S + 8 })).toEqual({ sets: [3 * S + 9, 3 * S + 10] });
	});
});

describe('entries that depend on a refused one', () => {
	const A = dep('A', {
		minted: { exercises: [3 * S + 1] },
		rows: [row({ tbl: 'exercises', key: String(3 * S + 1), op: 'i' })]
	});

	it('holds a log on a drill whose creation was refused', () => {
		const B = dep('B', { url: `/salsa/exercises/${3 * S + 1}?/done` });
		expect(dependsOn(B, A)).toBe(true);
		expect(heldBy([A, B], new Set(['A']))).toEqual(new Map([['B', 'A']]));
		expect(heldBy([A, B], new Set())).toEqual(new Map());
	});

	it('holds a second edit to a row refused in a clash', () => {
		const one = dep('one', { rows: [row({ tbl: 'lessons', key: '4' })] });
		const two = dep('two', { rows: [row({ tbl: 'lessons', key: '4' })] });
		const other = dep('other', { rows: [row({ tbl: 'lessons', key: '5' })] });
		expect(heldBy([one, two, other], new Set(['one']))).toEqual(new Map([['two', 'one']]));
	});

	it('holds transitively and names the refused root', () => {
		const B = dep('B', {
			rows: [row({ tbl: 'sets', key: '9', op: 'i', after: { id: 9, exercise_id: 3 * S + 1 } })],
			minted: { sets: [9] }
		});
		const C = dep('C', { rows: [row({ tbl: 'sets', key: '9', op: 'u' })] });
		expect(heldBy([A, B, C], new Set(['A']))).toEqual(
			new Map([
				['B', 'A'],
				['C', 'A']
			])
		);
	});
});

describe('what an entry shows', () => {
	it('marks a heart by its comment and a YouTube save by its link', () => {
		expect(
			queuedMarks([
				row({
					tbl: 'lesson_comment_hearts',
					key: '[4,"u1"]',
					op: 'i',
					after: { comment_id: 4, user_id: 'u1' }
				}),
				row({ tbl: 'video_downloads', key: '8', op: 'i', after: { id: 8, link_id: 6 } }),
				row({ tbl: 'lesson_comments', key: '12', op: 'i', after: { id: 12 } }),
				row({ tbl: 'sets', key: '1', op: 'i', after: { id: 1 } })
			])
		).toEqual(['lesson_comments:4', 'links:6', 'lesson_comments:12']);
	});

	it('labels a notes-only change "note", a rename "name", an archive "removed"', () => {
		const u = (before: Record<string, string | null>, after: Record<string, string | null>) => [
			row({
				tbl: 'figures',
				key: '1',
				op: 'u',
				before: { id: 1, ...before },
				after: { id: 1, ...after }
			})
		];
		expect(
			entryLabel('update', u({ notes: 'a', name: 'X' }, { notes: 'b', name: 'X' }), 'X').kind
		).toBe('note');
		expect(entryLabel('update', u({ name: 'X' }, { name: 'Y' }), 'Y').kind).toBe('name');
		expect(entryLabel('archive', u({ archived_at: null }, { archived_at: '5' }), 'Y').kind).toBe(
			'removed'
		);
		expect(
			entryLabel('update', u({ name: 'X', partner: 'a' }, { name: 'Y', partner: 'b' }), 'Y').kind
		).toBe('edit');
		expect(entryLabel('done', [], 'Enchufla')).toEqual({ kind: 'log', thing: 'Enchufla' });
		expect(entryLabel('x', [], null)).toEqual({ kind: 'other', thing: null });
		expect(
			entryLabel('create', [row({ tbl: 'lessons', key: '2', op: 'i', after: { id: 2 } })], 'L').kind
		).toBe('new');
		expect(
			entryLabel(
				'post',
				[row({ tbl: 'lesson_comments', key: '2', op: 'i', after: { id: 2 } })],
				null
			).kind
		).toBe('comment');
		expect(
			entryLabel('heart', [row({ tbl: 'lesson_comment_hearts', key: '[2,"u1"]', op: 'i' })], null)
				.kind
		).toBe('heart');
	});

	it('reads the text fields of a url-encoded and a multipart body, without seen', async () => {
		const enc = new TextEncoder();
		expect(
			await bodyFields(
				'application/x-www-form-urlencoded',
				enc.encode('name=Basic&seen=%7B%7D&notes=a+b')
			)
		).toEqual([
			['name', 'Basic'],
			['notes', 'a b']
		]);
		const fd = new FormData();
		fd.set('name', 'Basic');
		fd.set('fingerprint', 'x');
		fd.set('file', new Blob(['zzz']), 'f.bin');
		const req = new Request('http://x/', { method: 'POST', body: fd });
		const bytes = new Uint8Array(await req.arrayBuffer());
		expect(await bodyFields(req.headers.get('content-type'), bytes)).toEqual([['name', 'Basic']]);
		expect(await bodyFields('application/json', enc.encode('{}'))).toEqual([]);
		expect(await bodyFields(null, null)).toEqual([]);
	});

	it('round-trips bytes through base64', () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 255, 65]);
		expect(bytesOf(base64Of(bytes))).toEqual(bytes);
		expect(base64Of(new Uint8Array())).toBe('');
	});
});
