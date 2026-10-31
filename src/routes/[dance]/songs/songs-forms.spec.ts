/**
 * The Add a song sheet's refusals: each names the field it is about, so the
 * sheet can show it under that field, and hands back everything that was
 * typed — the picked style included, so a refused bachata link never comes
 * back as salsa's first style.
 *
 * A song page's tap and sample refusals name their action, so each shows
 * under its own control.
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
import {
	createSongFromUrl,
	getSong,
	listSongs,
	storeAnalysis,
	storeFetchedAudio
} from '$lib/server/songs';
import * as songList from './+page.server';
import * as songPage from './[id]/+page.server';

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

/** A song ready to count: audio, and a beat every 0.3 s for a minute. */
function readySong(dance: 'salsa' | 'bachata' = 'salsa') {
	const song = createSongFromUrl(db, dance, {
		url: 'https://www.youtube.com/watch?v=Kd3Qe0bP2sA',
		title: 'Quimbara',
		style: dance === 'salsa' ? 'salsa' : 'sensual'
	});
	storeFetchedAudio(db, song.id, { file: 'a.m4a', mime: 'audio/mp4', title: null, durationS: 60 });
	const beats = Array.from({ length: 200 }, (_, i) => i * 0.3);
	storeAnalysis(db, song.id, { beats, downbeats: [], durationS: 60 });
	return song.id;
}

describe('A song', () => {
	it('names the tap in a refused tap on a waiting song', async () => {
		const { id } = createSongFromUrl(db, 'salsa', {
			url: 'https://www.youtube.com/watch?v=Kd3Qe0bP2sA',
			title: '',
			style: 'salsa'
		});
		expect(await call(songPage.actions.tap, post('salsa', { t: '12' }, String(id)))).toMatchObject({
			status: 400,
			data: { action: 'tap', message: 'Play the song first.' }
		});
	});

	it('names the sample in a refused sample start', async () => {
		const id = readySong();
		expect(
			await call(songPage.actions.sample, post('salsa', { t: 'abc' }, String(id)))
		).toMatchObject({ status: 400, data: { action: 'sample', message: 'Play the song first.' } });
	});

	it('names the count speed in a refused change', async () => {
		const id = readySong();
		expect(
			await call(songPage.actions.tempo, post('salsa', { factor: '3' }, String(id)))
		).toMatchObject({ status: 400, data: { action: 'tempo', message: 'Bad tempo.' } });
	});

	it('names the retry in a refused retry of a song that has not failed', async () => {
		const id = readySong();
		expect(await call(songPage.actions.retry, post('salsa', {}, String(id)))).toMatchObject({
			status: 409,
			data: { action: 'retry' }
		});
	});

	it('files a tap on a ready song', async () => {
		const id = readySong();
		expect(await call(songPage.actions.tap, post('salsa', { t: '12' }, String(id)))).toEqual({
			ok: true
		});
		expect(JSON.parse(getSong(db, id)!.anchorsJson)).toHaveLength(1);
	});

	it('will not take a tap on a salsa song from a bachata URL', async () => {
		const id = readySong('salsa');
		expect(
			await call(songPage.actions.tap, post('bachata', { t: '12' }, String(id)))
		).toMatchObject({ status: 404 });
		expect(getSong(db, id)!.anchorsJson).toBe('[]');
	});

	it('loads the length of the song', () => {
		const id = readySong();
		const data = songPage.load(post('salsa', {}, String(id)) as never) as {
			song: { durationS: number | null };
		};
		expect(data.song.durationS).toBe(60);
	});
});

describe('Song details', () => {
	const edit = (dance: 'salsa' | 'bachata', id: number, fields: Record<string, string>) =>
		call(songPage.actions.update, post(dance, fields, String(id)));

	it('puts a missing title under Title, keeping artist and style', async () => {
		const id = readySong('bachata');
		expect(
			await edit('bachata', id, { title: '', artist: 'Romeo', style: 'sensual' })
		).toMatchObject({
			status: 400,
			data: {
				field: 'title',
				message: 'Give the song a title (up to 200 characters).',
				title: '',
				artist: 'Romeo',
				style: 'sensual'
			}
		});
	});

	it('puts a long artist under Artist', async () => {
		const id = readySong('bachata');
		expect(
			await edit('bachata', id, { title: 'x', artist: 'x'.repeat(201), style: 'sensual' })
		).toMatchObject({
			status: 400,
			data: { field: 'artist', message: 'Keep the artist to 200 characters.' }
		});
	});

	it('names no field for a style of the other dance', async () => {
		const id = readySong('bachata');
		const result = (await edit('bachata', id, { title: 'x', artist: '', style: 'son' })) as {
			status: number;
			data: Record<string, unknown>;
		};
		expect(result.status).toBe(400);
		expect(result.data.message).toBe('Pick a style.');
		expect(result.data.field).toBeUndefined();
	});

	it('saves a good edit', async () => {
		const id = readySong('bachata');
		expect(await edit('bachata', id, { title: 'New', artist: 'A', style: 'dominican' })).toEqual({
			ok: true
		});
		expect(getSong(db, id)).toMatchObject({ title: 'New', artist: 'A', style: 'dominican' });
	});

	it('archives to Music and the song is gone', async () => {
		const id = readySong('bachata');
		expect(await call(songPage.actions.archive, post('bachata', {}, String(id)))).toMatchObject({
			status: 303,
			location: '/bachata/songs'
		});
		expect(() => songPage.load(post('bachata', {}, String(id)) as never)).toThrow();
	});
});
