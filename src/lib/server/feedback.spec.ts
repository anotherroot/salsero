import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { users } from './db/schema';
import {
	DONE_SHOWN,
	MESSAGE_MAX,
	SHOT_MAX_BYTES,
	feedbackFor,
	keepShot,
	markFeedback,
	openFeedbackCount,
	readFeedback,
	readShot,
	sendFeedback,
	shotOf,
	type FeedbackInput
} from './feedback';
import { feedbackView } from '$lib/admin-view';

const T0 = 1_762_770_000_000;
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'a', email: 'a@x', passwordHash: 'x', dance: 'salsa', firstName: 'Ana', lastName: 'K' },
			{ id: 'b', email: 'b@x', passwordHash: 'x', dance: 'bachata' }
		])
		.run();
});

const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};

const input = (message: string): FeedbackInput => ({
	message,
	page: '/salsa/moves/3',
	trail: ['/salsa', '/salsa/moves/3', '/salsa/groups'],
	errors: [],
	siteVersion: String(T0),
	viewport: '390×844'
});

describe('readFeedback', () => {
	it('takes the message and what the page sent', () => {
		expect(
			readFeedback(
				form({
					message: '  The count stops  ',
					page: '/salsa/moves/3?in=4',
					trail: JSON.stringify(['/salsa', '/salsa/moves/3?in=4']),
					errors: JSON.stringify(['TypeError: x']),
					version: '1762770000000',
					viewport: '390×844'
				})
			)
		).toEqual({
			message: 'The count stops',
			page: '/salsa/moves/3?in=4',
			trail: ['/salsa', '/salsa/moves/3?in=4'],
			errors: ['TypeError: x'],
			siteVersion: '1762770000000',
			viewport: '390×844'
		});
	});

	it('refuses an empty or too long message', () => {
		expect(readFeedback(form({ message: '   ' }))).toBe('empty');
		expect(readFeedback(form({ message: 'x'.repeat(MESSAGE_MAX + 1) }))).toBe('long');
	});

	it('drops what the page sent wrong, never refusing for it', () => {
		const r = readFeedback(
			form({
				message: 'hi',
				page: 'https://evil.example/',
				trail: '{"not":"a list"}',
				errors: 'not json',
				version: '<script>',
				viewport: 'huge'
			})
		);
		expect(r).toEqual({
			message: 'hi',
			page: null,
			trail: [],
			errors: [],
			siteVersion: null,
			viewport: null
		});
		const many = readFeedback(
			form({ message: 'hi', trail: JSON.stringify(Array.from({ length: 50 }, (_, i) => `/${i}`)) })
		);
		expect(many !== 'empty' && many !== 'long' && many.trail.length).toBe(8);
	});
});

describe('feedback for the admin', () => {
	it('keeps a message in its dance, with the app and browser', () => {
		sendFeedback(
			db,
			{ userId: 'a', dance: 'salsa' },
			input('The count stops'),
			{
				agent: { versionCode: 9, dance: 'salsa', channel: 'play' },
				userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) Chrome/131.0 Mobile'
			},
			T0
		);
		sendFeedback(
			db,
			{ userId: 'b', dance: 'bachata' },
			input('Bachata'),
			{ agent: null, userAgent: null },
			T0
		);
		const { open, done } = feedbackFor(db, 'salsa');
		expect(open).toHaveLength(1);
		expect(done).toEqual([]);
		expect(open[0]).toMatchObject({
			email: 'a@x',
			message: 'The count stops',
			trail: ['/salsa', '/salsa/moves/3', '/salsa/groups'],
			appVersion: 9,
			appChannel: 'play'
		});
		expect(openFeedbackCount(db, 'salsa')).toBe(1);
		expect(openFeedbackCount(db, 'bachata')).toBe(1);
	});

	it('moves a message to done and back, only in its own dance', () => {
		const id = sendFeedback(
			db,
			{ userId: 'a', dance: 'salsa' },
			input('x'),
			{ agent: null, userAgent: null },
			T0
		);
		expect(markFeedback(db, 'bachata', id, T0 + 1)).toBe(false);
		expect(markFeedback(db, 'salsa', id, T0 + 1)).toBe(true);
		expect(openFeedbackCount(db, 'salsa')).toBe(0);
		expect(feedbackFor(db, 'salsa').done.map((r) => r.id)).toEqual([id]);
		expect(markFeedback(db, 'salsa', id, null)).toBe(true);
		expect(feedbackFor(db, 'salsa').open.map((r) => r.id)).toEqual([id]);
		expect(markFeedback(db, 'salsa', 999, T0)).toBe(false);
	});

	it('lists only the last done ones', () => {
		for (let i = 0; i < DONE_SHOWN + 2; i++) {
			const id = sendFeedback(
				db,
				{ userId: 'a', dance: 'salsa' },
				input(`m${i}`),
				{ agent: null, userAgent: null },
				T0 + i
			);
			markFeedback(db, 'salsa', id, T0 + i);
		}
		const done = feedbackFor(db, 'salsa').done;
		expect(done).toHaveLength(DONE_SHOWN);
		expect(feedbackFor(db, 'salsa').doneCount).toBe(DONE_SHOWN + 2);
		expect(done[0].message).toBe(`m${DONE_SHOWN + 1}`);
	});

	it('reads as lines for the admin', () => {
		sendFeedback(
			db,
			{ userId: 'a', dance: 'salsa' },
			input('The count stops'),
			{
				agent: { versionCode: 9, dance: 'salsa', channel: 'play' },
				userAgent:
					'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'
			},
			T0
		);
		const v = feedbackView(feedbackFor(db, 'salsa').open[0], 'Europe/Ljubljana');
		expect(v).toMatchObject({ who: 'Ana K', email: 'a@x', done: false });
		expect(v.sent).toBe('Sent Mon 10 Nov, 11:20');
		expect(v.lines).toEqual([
			'Page: /salsa/moves/3',
			'Before: /salsa',
			'Android app 9 (Play) · Android 14 · WebView 131',
			'Window 390×844',
			'Site of Mon 10 Nov, 11:20'
		]);
	});
});

describe('the screenshot', () => {
	const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
	const withShot = (blob: Blob | string | null) => {
		const f = new FormData();
		if (blob !== null) f.set('shot', blob);
		return f;
	};

	it('reads a JPEG, and leaves out the rest', async () => {
		expect(await readShot(withShot(new Blob([JPEG], { type: 'image/jpeg' })))).toEqual(JPEG);
		expect(await readShot(withShot(null))).toBeNull();
		expect(await readShot(withShot(''))).toBeNull();
		expect(await readShot(withShot(new Blob([])))).toBeNull();
		expect(await readShot(withShot(new Blob(['<svg/>'], { type: 'image/jpeg' })))).toBe('bad');
		const huge = new Uint8Array(SHOT_MAX_BYTES + 1);
		huge.set(JPEG);
		expect(await readShot(withShot(new Blob([huge])))).toBe('bad');
	});

	it('is kept beside the message and found only in its dance', () => {
		const dir = mkdtempSync(join(tmpdir(), 'feedback-'));
		try {
			const id = sendFeedback(
				db,
				{ userId: 'a', dance: 'salsa' },
				input('look'),
				{ agent: null, userAgent: null },
				T0
			);
			keepShot(db, dir, id, JPEG);
			expect(readFileSync(join(dir, `${id}.jpg`))).toEqual(Buffer.from(JPEG));
			expect(shotOf(db, 'salsa', id)).toBe(`${id}.jpg`);
			expect(shotOf(db, 'bachata', id)).toBeNull();
			const [row] = feedbackFor(db, 'salsa').open;
			expect(feedbackView(row, 'UTC').shot).toBe(`/admin/feedback/${id}/shot`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
