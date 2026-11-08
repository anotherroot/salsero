/**
 * What the comments API says when it refuses, in the person's language: the
 * sheet shows the server's message as it comes. The hook runs every request
 * inside `runInLocale`; here the handlers run inside it directly. `getDb()` is
 * mocked for the reason `dance-wall.spec.ts` gives.
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
import { users } from '$lib/server/db/schema';
import { postComment } from '$lib/server/comments';
import { runInLocale } from '$lib/server/i18n-request';
import { createLesson, publishLesson } from '$lib/server/lessons';
import { createTeam, deleteTeam, joinTeam } from '$lib/server/teams';
import { T1_SALSA } from '$lib/server/test-walls';
import * as lessonComments from './lessons/[id]/comments/+server';
import * as comment from './comments/[id]/+server';
import * as heart from './comments/[id]/heart/+server';
import * as restore from './comments/[id]/restore/+server';

const U1 = { id: 'u1', email: 'u1@x.si', timezone: 'UTC', dance: 'salsa', isAdmin: false };

type Handler = (event: unknown) => unknown;
function event(id: number | string, body?: unknown) {
	return {
		params: { id: String(id) },
		locals: { user: U1 },
		request: new Request('http://localhost/', {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	};
}

/** The message a handler answers or throws, under a language. */
async function said(locale: 'en' | 'sl', fn: Handler, ev: unknown): Promise<string | undefined> {
	return runInLocale(locale, async () => {
		try {
			const res = (await fn(ev)) as Response;
			return ((await res.json()) as { message?: string }).message;
		} catch (e) {
			return (e as { body?: { message?: string } }).body?.message;
		}
	});
}

let db: Db;
let lesson: number;
let posted: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const [id, firstName] of [
		['u1', 'Teo'],
		['u2', 'Maja']
	]) {
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	}
	createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	const input = { lessonDay: '2026-11-03', title: 'Tue 3 Nov', notes: null };
	lesson = createLesson(db, T1_SALSA, input).lesson.id;
	publishLesson(db, T1_SALSA, lesson, 5);
	const made = postComment(db, 'u2', lesson, 'Which foot?', null, 10);
	if ('refused' in made) throw new Error(made.message);
	posted = made.id;
});

describe('the comments API in Slovenian', () => {
	it('a missing lesson or comment', async () => {
		const get = lessonComments.GET as unknown as Handler;
		expect(await said('sl', get, event(999))).toBe('Te lekcije ni.');
		expect(await said('en', get, event(999))).toBe('No such lesson');
		const del = comment.DELETE as unknown as Handler;
		expect(await said('sl', del, event(999))).toBe('Tega komentarja ni.');
		expect(await said('en', del, event(999))).toBe('No such comment');
	});

	it('a body refused', async () => {
		const post = lessonComments.POST as unknown as Handler;
		expect(await said('sl', post, event(lesson, { body: ' ' }))).toBe('Najprej kaj napišite.');
	});

	it('a deleted class is read-only', async () => {
		deleteTeam(db, 1, 'u1', 1000);
		const closed = 'Ta tečaj je izbrisan, zato lahko komentarje le še berete.';
		for (const fn of [heart.POST, restore.POST, comment.DELETE]) {
			expect(await said('sl', fn as unknown as Handler, event(posted))).toBe(closed);
		}
		const post = lessonComments.POST as unknown as Handler;
		expect(await said('sl', post, event(lesson, { body: 'x' }))).toBe(closed);
		expect(await said('en', heart.POST as unknown as Handler, event(posted))).toBe(
			'This class has been deleted, so its comments can only be read.'
		);
	});
});
