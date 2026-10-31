/**
 * The Add a song sheet's refusals: each names the field it is about, so the
 * sheet can show it under that field, and hands back everything that was
 * typed — the picked style included, so a refused bachata link never comes
 * back as salsa's first style.
 *
 * Like `dance-wall.spec.ts`, the action reaches the database through
 * `getDb()`, which is mocked: each test gets its own `openDb(':memory:')` and
 * nothing ever opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { listSongs } from '$lib/server/songs';
import * as songList from './+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string>, id = '') {
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
/** The action's `fail` data, or what it threw (`error`, `redirect`). */
async function call(action: unknown, event: ReturnType<typeof post>): Promise<unknown> {
	try {
		return await (action as Invoke)(event);
	} catch (thrown) {
		return thrown;
	}
}

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});

describe('Add a song', () => {
	it('puts a bad link under the link field in bachata, keeping every field', async () => {
		expect(
			await call(
				songList.actions.addUrl,
				post('bachata', { url: 'youtube.com/watch?v=7hdQ', title: 'Obsesión', style: 'sensual' })
			)
		).toMatchObject({
			status: 400,
			data: {
				field: 'url',
				message: 'Paste a full link, starting with https://',
				url: 'youtube.com/watch?v=7hdQ',
				title: 'Obsesión',
				style: 'sensual'
			}
		});
		expect(listSongs(db, 'bachata')).toHaveLength(0);
	});

	it('puts a long title under Title, keeping the link and the style', async () => {
		const long = 'x'.repeat(201);
		expect(
			await call(
				songList.actions.addUrl,
				post('bachata', {
					url: 'https://www.youtube.com/watch?v=7hdQ',
					title: long,
					style: 'traditional'
				})
			)
		).toMatchObject({
			status: 400,
			data: {
				field: 'title',
				message: 'Keep the title to 200 characters.',
				url: 'https://www.youtube.com/watch?v=7hdQ',
				title: long,
				style: 'traditional'
			}
		});
		expect(listSongs(db, 'bachata')).toHaveLength(0);
	});

	it('checks the link before the title', async () => {
		expect(
			await call(
				songList.actions.addUrl,
				post('salsa', { url: 'not a link', title: 'x'.repeat(201), style: 'son' })
			)
		).toMatchObject({ status: 400, data: { field: 'url', style: 'son' } });
	});

	it('adds a good link waiting to download, in its dance', async () => {
		expect(
			await call(
				songList.actions.addUrl,
				post('bachata', {
					url: 'https://www.youtube.com/watch?v=7hdQ',
					title: 'Obsesión',
					style: 'sensual'
				})
			)
		).toEqual({ ok: true });
		const [song] = listSongs(db, 'bachata');
		expect(song).toMatchObject({ status: 'waiting_download', style: 'sensual', title: 'Obsesión' });
		expect(listSongs(db, 'salsa')).toHaveLength(0);
	});

	it("files a style from the other dance under the dance's first style", async () => {
		expect(
			await call(
				songList.actions.addUrl,
				post('bachata', { url: 'https://www.youtube.com/watch?v=7hdQ', style: 'son' })
			)
		).toEqual({ ok: true });
		expect(listSongs(db, 'bachata')[0].style).toBe('dominican');
	});
});
