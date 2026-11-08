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
const short = vi.hoisted(() => ({ to: null as string | null }));
vi.mock('$lib/server/short-link', () => ({ resolveShortLink: async () => short.to }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { songs, teams, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { groupCookie } from '$lib/teams/mode';
import { T1_SALSA, U1_BACHATA, U1_SALSA } from '$lib/server/test-walls';
import {
	createSongFromUpload,
	createSongFromUrl,
	getSong,
	listSongs,
	storeAnalysis,
	storeFetchedAudio,
	failJob
} from '$lib/server/songs';
import { songSeen } from '$lib/server/clash';
import * as songList from './+page.server';
import * as songPage from './[id]/+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana', dance: 'salsa' };

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(
	dance: string,
	fields: Record<string, string>,
	id = '',
	as: { user?: string; group?: string } = {}
) {
	return {
		params: { dance, id },
		url: new URL(`http://localhost/${dance}/songs/${id}`),
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: { ...USER, dance, ...(as.user ? { id: as.user } : {}) } },
		cookies: {
			get: (n: string) => (n === groupCookie(dance as 'salsa' | 'bachata') ? as.group : undefined),
			set: () => {},
			delete: () => {}
		} as unknown as Cookies
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
		expect(listSongs(db, U1_BACHATA)).toHaveLength(0);
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
		expect(listSongs(db, U1_BACHATA)).toHaveLength(0);
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
		const [song] = listSongs(db, U1_BACHATA);
		expect(song).toMatchObject({ status: 'waiting_download', style: 'sensual', title: 'Obsesión' });
		expect(listSongs(db, U1_SALSA)).toHaveLength(0);
	});

	it("files a style from the other dance under the dance's first style", async () => {
		expect(
			await call(
				songList.actions.addUrl,
				post('bachata', { url: 'https://www.youtube.com/watch?v=7hdQ', style: 'son' })
			)
		).toEqual({ ok: true });
		expect(listSongs(db, U1_BACHATA)[0].style).toBe('dominican');
	});
});

describe('Music in group mode', () => {
	const link = { url: 'https://www.youtube.com/watch?v=7hdQ', title: 'Clase', style: 'salsa' };
	beforeEach(() => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		joinTeam(db, 'u2', 1, 2);
	});

	it("adds a link as the group's draft, never the person's", async () => {
		expect(await call(songList.actions.addUrl, post('salsa', link, '', { group: '1' }))).toEqual({
			ok: true
		});
		expect(listSongs(db, U1_SALSA)).toHaveLength(0);
		expect(listSongs(db, T1_SALSA)).toMatchObject([{ title: 'Clase', sharedAt: null }]);
	});

	it("is refused at the group's limit, with the group's message", async () => {
		db.update(teams).set({ storageLimitBytes: 1 }).where(eq(teams.id, 1)).run();
		createSongFromUpload(db, T1_SALSA, {
			file: 'g.mp3',
			mime: 'audio/mpeg',
			title: 'G',
			style: 'salsa',
			sizeBytes: 1
		});
		expect(
			await call(songList.actions.addUrl, post('salsa', link, '', { group: '1' }))
		).toMatchObject({ status: 413, data: { field: 'url', message: /the group uses/ } });
		// The person's own room is untouched by the group's.
		expect(await call(songList.actions.addUrl, post('salsa', link))).toEqual({ ok: true });
	});

	it("retries a failed group song for its editor; a member's retry is a 404", async () => {
		const { id } = createSongFromUrl(db, T1_SALSA, link);
		failJob(db, id, 'gone', true);
		db.update(songs).set({ sharedAt: 1 }).where(eq(songs.id, id)).run();
		expect(
			await call(songList.actions.retry, post('salsa', { id: String(id) }, '', { user: 'u2' }))
		).toMatchObject({ status: 404 });
		expect(getSong(db, id)!.status).toBe('failed');
		expect(await call(songList.actions.retry, post('salsa', { id: String(id) }))).toEqual({
			ok: true
		});
		expect(getSong(db, id)!.status).toBe('waiting_download');
	});
});

/** A song ready to count: audio, and a beat every 0.3 s for a minute. */
function readySong(dance: 'salsa' | 'bachata' = 'salsa') {
	const song = createSongFromUrl(
		db,
		{ userId: 'u1', dance },
		{
			url: 'https://www.youtube.com/watch?v=Kd3Qe0bP2sA',
			title: 'Quimbara',
			style: dance === 'salsa' ? 'salsa' : 'sensual'
		}
	);
	storeFetchedAudio(db, song.id, { file: 'a.m4a', mime: 'audio/mp4', title: null, durationS: 60 });
	const beats = Array.from({ length: 200 }, (_, i) => i * 0.3);
	storeAnalysis(db, song.id, { beats, downbeats: [], durationS: 60 });
	return song.id;
}

describe('A song', () => {
	it('names the tap in a refused tap on a waiting song', async () => {
		const { id } = createSongFromUrl(db, U1_SALSA, {
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

	it('never clash-checks one’s own song: stale or absent `seen`, every edit lands', async () => {
		const id = readySong();
		const stale = JSON.stringify(songSeen(getSong(db, id)!));
		const tap = (t: string, fields: Record<string, string> = {}) =>
			call(songPage.actions.tap, post('salsa', { t, ...fields }, String(id)));
		expect(await tap('12', { seen: stale })).toEqual({ ok: true });
		expect(await tap('24', { seen: stale })).toEqual({ ok: true });
		expect(await tap('36')).toEqual({ ok: true });
		expect(getSong(db, id)!.anchorsJson).not.toBe(JSON.parse(stale).anchorsJson);
		expect(
			await call(songPage.actions.sample, post('salsa', { t: '10', seen: stale }, String(id)))
		).toEqual({ ok: true });
		expect(
			await call(
				songPage.actions.removeAnchor,
				post('salsa', { beat: '0', seen: stale }, String(id))
			)
		).toEqual({ ok: true });
		const page = songPage.load(post('salsa', {}, String(id)) as never) as { seen: unknown };
		expect(page.seen).toBeNull();
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

describe('Add a song when the person is at the storage limit', () => {
	it('is refused with 413 and queues nothing', async () => {
		db.insert(users)
			.values({ id: 'u1', email: 'u@example.com', passwordHash: 'x', storageLimitBytes: 0 })
			.run();
		expect(
			await call(
				songList.actions.addUrl,
				post('salsa', { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'T', style: 'son' })
			)
		).toMatchObject({ status: 413, data: { field: 'url' } });
		expect(listSongs(db, U1_SALSA)).toHaveLength(0);
	});
});

describe('Retry a song when the person is at the storage limit', () => {
	function failedSong() {
		db.insert(users)
			.values({ id: 'u1', email: 'u@example.com', passwordHash: 'x', storageLimitBytes: 0 })
			.run();
		const song = createSongFromUrl(db, U1_SALSA, {
			url: 'https://youtu.be/dQw4w9WgXcQ',
			title: 'T',
			style: 'son'
		});
		failJob(db, song.id, 'boom', true);
		return song.id;
	}

	it('is refused with 413 from the list and from the song page', async () => {
		const id = failedSong();
		expect(await call(songList.actions.retry, post('salsa', { id: String(id) }))).toMatchObject({
			status: 413
		});
		expect(await call(songPage.actions.retry, post('salsa', {}, String(id)))).toMatchObject({
			status: 413,
			data: { action: 'retry' }
		});
		expect(getSong(db, id)?.status).toBe('failed');
	});
});

describe('Add a song: Spotify and lists', () => {
	const TRACK = 'https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO?si=7ijevtD4QBSS07u37hj8kw';
	const add = (url: string) =>
		call(songList.actions.addUrl, post('salsa', { url, title: '', style: 'salsa' }));

	it('adds a Spotify song waiting to download, its link as pasted', async () => {
		expect(await add(TRACK)).toEqual({ ok: true });
		expect(listSongs(db, U1_SALSA)).toMatchObject([
			{ status: 'waiting_download', sourceUrl: TRACK }
		]);
	});

	it('refuses a Spotify link that is no song, playlist or album', async () => {
		expect(await add('https://open.spotify.com/episode/x1')).toMatchObject({
			status: 400,
			data: { field: 'url', message: 'Paste a song, playlist or album' }
		});
	});

	it('refuses a playlist for now, with a sentence', async () => {
		for (const url of [
			'https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W',
			'https://www.youtube.com/playlist?list=PLo1L1g'
		])
			expect(await add(url)).toMatchObject({
				status: 400,
				data: {
					field: 'url',
					message: "Playlists come in the next update. Paste one song's link for now."
				}
			});
		expect(listSongs(db, U1_SALSA)).toHaveLength(0);
	});

	it('follows a short link to the song it names', async () => {
		short.to = 'https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO?si=1';
		expect(await add('https://spotify.link/AbCdE')).toEqual({ ok: true });
		expect(listSongs(db, U1_SALSA)).toMatchObject([{ sourceUrl: short.to }]);
	});

	it('asks for the full link when a short one leads nowhere', async () => {
		short.to = null;
		expect(await add('https://spotify.link/AbCdE')).toMatchObject({
			status: 400,
			data: { field: 'url', message: 'Paste the full open.spotify.com link' }
		});
	});
});

describe('Use another YouTube link', () => {
	const swap = (id: number, fields: Record<string, string>) =>
		call(songPage.actions.audio, post('salsa', fields, String(id)));

	it('re-queues a ready song from the new link, keeping its old audio until then', async () => {
		const id = readySong();
		expect(await swap(id, { audioUrl: 'https://youtu.be/Fd8nEwF3hHk' })).toEqual({ ok: true });
		expect(getSong(db, id)).toMatchObject({
			audioUrl: 'https://youtu.be/Fd8nEwF3hHk',
			status: 'waiting_download',
			audioFile: 'a.m4a',
			anchorsJson: '[]'
		});
	});

	it('takes only a YouTube video', async () => {
		const id = readySong();
		expect(
			await swap(id, { audioUrl: 'https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO' })
		).toMatchObject({
			status: 400,
			data: { field: 'audioUrl', message: 'Paste a YouTube video link' }
		});
	});

	it('waits for a song still downloading', async () => {
		const { id } = createSongFromUrl(db, U1_SALSA, {
			url: 'https://youtu.be/x',
			title: 'W',
			style: 'salsa'
		});
		expect(await swap(id, { audioUrl: 'https://youtu.be/Fd8nEwF3hHk' })).toMatchObject({
			status: 409,
			data: { field: 'audioUrl', message: 'Wait until this song has finished downloading.' }
		});
	});

	it("refuses a group's song without what the editor saw", async () => {
		createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		const song = createSongFromUrl(db, T1_SALSA, {
			url: 'https://youtu.be/x',
			title: 'G',
			style: 'salsa'
		});
		storeFetchedAudio(db, song.id, {
			file: 'g.m4a',
			mime: 'audio/mp4',
			title: null,
			durationS: 60
		});
		storeAnalysis(db, song.id, { beats: [0.5, 1], downbeats: [], durationS: 60 });
		const res = await call(
			songPage.actions.audio,
			post('salsa', { audioUrl: 'https://youtu.be/Fd8nEwF3hHk' }, String(song.id), { group: '1' })
		);
		// A missing `seen` is refused as Song details' is (400), never a quiet overwrite.
		// It names the field, so Song details shows it under Another YouTube link.
		expect(res).toMatchObject({ status: 400, data: { field: 'audioUrl' } });
		expect(getSong(db, song.id)?.audioUrl).toBeNull();
	});
});
