/**
 * A class's songs reach its members: the shared ones play (`/audio/[file]`),
 * give their grid, and open in the player; a draft, an outsider and a former
 * member get the same 404 as a missing song. `$DATA_DIR` and the database are
 * mocked, never set through `process.env` (see CLAUDE.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { leaveTeam } from '$lib/server/membership';
import { NO_FILES } from '$lib/server/test-walls';
import {
	CLASS_T,
	DRAFT_FILE,
	makeClass,
	OTHER_FILE,
	SHARED_FILE,
	type Class
} from '$lib/server/test-class';
import { GET as getAudio } from '../../audio/[file]/+server';
import { GET as getGrid } from './[id]/grid/+server';
import { load as playerLoad } from '../player/+page.server';
import * as songPage from './[id]/+page.server';
import { load as musicLoad } from './+layout.server';
import { load as groupLoad } from '../groups/[id]/+page.server';
import { load as groupsLoad } from '../groups/+layout.server';
import { POST as postOpen } from '../../api/opens/+server';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { archiveSong, getSong } from '$lib/server/songs';
import { archivedSongCopy } from '$lib/clones/view';
import { songSeen } from '$lib/server/clash';
import { history } from '$lib/server/changes';
import { groupCookie } from '$lib/teams/mode';
import type { PickerSong } from '$lib/types';

const user = (id: string) => ({
	id,
	email: `${id}@x.si`,
	timezone: 'Europe/Ljubljana',
	dance: 'salsa'
});

let db: Db;
let c: Class;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-group-songs-'));
	await mkdir(join(envMock.DATA_DIR, 'audio'), { recursive: true });
	for (const f of [SHARED_FILE, DRAFT_FILE, OTHER_FILE]) {
		await writeFile(join(envMock.DATA_DIR, 'audio', f), Buffer.alloc(10, 1));
	}
	db = openDb(':memory:');
	handle.db = db;
	c = makeClass(db);
});

afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

/** The status a handler answers with, or the one it threw. */
async function status(run: () => unknown): Promise<number> {
	try {
		return ((await run()) as Response).status;
	} catch (thrown) {
		const s = (thrown as { status?: number }).status;
		if (typeof s !== 'number') throw thrown;
		return s;
	}
}

const audio = (file: string, as: string) =>
	status(() =>
		(getAudio as unknown as (e: unknown) => Promise<Response>)({
			params: { file },
			locals: { user: user(as) },
			request: new Request('http://localhost/')
		})
	);

const grid = (id: number, as: string) =>
	status(() =>
		(getGrid as unknown as (e: unknown) => Response)({
			params: { dance: 'salsa', id: String(id) },
			locals: { user: user(as) }
		})
	);

type PlayerLoad = (e: { params: { dance: string }; url: URL; locals: unknown }) => {
	songs: PickerSong[];
	start: { source: string; songId: number | null };
};
const player = (query: string, as: string) =>
	(playerLoad as unknown as PlayerLoad)({
		params: { dance: 'salsa' },
		url: new URL(`http://localhost/salsa/player?${query}`),
		locals: { user: user(as) }
	});
const playerStatus = (query: string, as: string) =>
	status(() => {
		player(query, as);
		return new Response(null, { status: 200 });
	});

describe('the audio of a group song', () => {
	it('a member plays the shared song; not the draft or another group’s', async () => {
		expect(await audio(SHARED_FILE, 'u3')).toBe(200);
		expect(await audio(DRAFT_FILE, 'u3')).toBe(404);
		expect(await audio(OTHER_FILE, 'u3')).toBe(404);
	});

	it('an editor plays the draft too', async () => {
		expect(await audio(DRAFT_FILE, 'u2')).toBe(200);
	});

	it('an outsider and a former member get a 404', async () => {
		expect(await audio(SHARED_FILE, 'u4')).toBe(404);
		await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, CLASS_T + 1);
		expect(await audio(SHARED_FILE, 'u3')).toBe(404);
	});
});

describe('the grid of a group song', () => {
	it('a member reads the shared one; not the draft', async () => {
		expect(await grid(c.shared, 'u3')).toBe(200);
		expect(await grid(c.draft, 'u3')).toBe(404);
		expect(await grid(c.other, 'u3')).toBe(404);
	});

	it('an outsider and a former member get a 404', async () => {
		expect(await grid(c.shared, 'u4')).toBe(404);
		await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, CLASS_T + 1);
		expect(await grid(c.shared, 'u3')).toBe(404);
	});

	it('gives the audio file and the beats', async () => {
		const res = (getGrid as unknown as (e: unknown) => Response)({
			params: { dance: 'salsa', id: String(c.shared) },
			locals: { user: user('u3') }
		});
		const body = (await res.json()) as { audioFile: string; beats: number[] };
		expect(body.audioFile).toBe(SHARED_FILE);
		expect(body.beats.length).toBeGreaterThan(0);
	});
});

describe('the player and a group song', () => {
	it('opens on the shared song, and lists it with its group', async () => {
		expect(await playerStatus(`song=${c.shared}`, 'u3')).toBe(200);
		expect(player(`song=${c.shared}`, 'u3').start).toMatchObject({
			source: 'song',
			songId: c.shared
		});
		expect(player('', 'u3').songs.map((s) => [s.id, s.group])).toEqual([
			[c.shared, 'Salsa Tuesdays']
		]);
	});

	it('refuses the draft, another group’s song, and a former member', async () => {
		expect(await playerStatus(`song=${c.draft}`, 'u3')).toBe(404);
		expect(await playerStatus(`song=${c.draft}`, 'u2')).toBe(404);
		expect(await playerStatus(`song=${c.other}`, 'u3')).toBe(404);
		await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, CLASS_T + 1);
		expect(await playerStatus(`song=${c.shared}`, 'u3')).toBe(404);
	});
});

// --- The screens: the song page, Music, the group page, opening a song.

type Fields = Record<string, string>;
const cookiesFor = (group?: number) =>
	({
		get: (n: string) => (n === groupCookie('salsa') && group ? String(group) : undefined),
		set: () => {},
		delete: () => {}
	}) as unknown as Cookies;
const ev = (as: string, id: number | string, fields: Fields = {}, group?: number) => ({
	params: { dance: 'salsa', id: String(id) },
	url: new URL(`http://localhost/salsa/songs/${id}`),
	request: new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	}),
	locals: { user: user(as) },
	cookies: cookiesFor(group)
});
/** An action's result, or what it threw (`error`, `redirect`). */
async function act(action: unknown, event: ReturnType<typeof ev>): Promise<unknown> {
	try {
		return await (action as (e: unknown) => unknown)(event);
	} catch (thrown) {
		return thrown;
	}
}
const seenOf = (id: number) => JSON.stringify(songSeen(getSong(db, id)!));

type SongPage = {
	canEdit: boolean;
	group: { id: number; name: string } | null;
	sharedAt: number | null;
	users: number;
	seen: unknown;
	makeMine: { label: string; team: string; bytes: number } | null;
	historyHref: string | null;
};
const songPageAs = (as: string, id: number) =>
	(songPage.load as unknown as (e: unknown) => SongPage)(ev(as, id));

type Music = {
	songs: { id: number }[];
	groups: { team: { id: number; name: string }; songs: { id: number; isNew: boolean }[] }[];
	users: Record<number, number>;
};
const musicAs = (as: string, group?: number) =>
	(musicLoad as unknown as (e: unknown) => Music)({
		params: { dance: 'salsa' },
		url: new URL('http://localhost/salsa/songs'),
		locals: { user: user(as) },
		cookies: cookiesFor(group),
		depends: () => {}
	});

describe('a group song’s page', () => {
	it('is read-only for a member: no edit, and every edit is a 404', async () => {
		const page = songPageAs('u3', c.shared);
		expect(page.canEdit).toBe(false);
		expect(page.group).toEqual({ id: 1, name: 'Salsa Tuesdays' });
		expect(page.historyHref).toBeNull();
		const seen = seenOf(c.shared);
		const edits: [unknown, Fields][] = [
			[songPage.actions.tap, { t: '12', seen }],
			[songPage.actions.removeAnchor, { beat: '0', seen }],
			[songPage.actions.resetAnchors, { seen }],
			[songPage.actions.tempo, { factor: '1', seen }],
			[songPage.actions.sample, { t: '10', seen }],
			[songPage.actions.sampleAuto, { seen }],
			[songPage.actions.one, { beat: '3', seen }],
			[songPage.actions.sectionAdd, { beat: '0', seen }],
			[songPage.actions.sectionEdit, { index: '0', name: 'x', seen }],
			[songPage.actions.sectionMove, { index: '0', dir: '1', seen }],
			[songPage.actions.sectionRemove, { index: '0', seen }],
			[songPage.actions.sectionsClear, { seen }],
			[songPage.actions.start, { t: '3', seen }],
			[songPage.actions.startZero, { seen }],
			[songPage.actions.startFound, { seen }],
			[songPage.actions.restore, { field: 'sections', value: '[]', seen }],
			[songPage.actions.update, { title: 'Mine', artist: '', style: 'salsa', seen }],
			[songPage.actions.share, {}],
			[songPage.actions.unshare, {}],
			[songPage.actions.delete, {}],
			[songPage.actions.archive, {}]
		];
		for (const [action, fields] of edits) {
			expect(await act(action, ev('u3', c.shared, fields))).toMatchObject({ status: 404 });
		}
		expect(getSong(db, c.shared)).toMatchObject({ title: 'Chan Chan', anchorsJson: '[]' });
	});

	it('is a 404 for a member on a draft, and for an outsider', () => {
		expect(() => songPageAs('u3', c.draft)).toThrow();
		expect(() => songPageAs('u4', c.shared)).toThrow();
	});

	it('is the editor’s to edit, with History and how many practise with it', () => {
		const page = songPageAs('u2', c.shared);
		expect(page.canEdit).toBe(true);
		expect(page.historyHref).toBe(`/salsa/groups/1/history/song/${c.shared}`);
		expect(page.users).toBe(0);
		expect(page.seen).toEqual(songSeen(getSong(db, c.shared)!));
	});

	it('takes an editor’s tap only with what they saw, and logs it', async () => {
		expect(await act(songPage.actions.tap, ev('u2', c.draft, { t: '12' }))).toMatchObject({
			status: 400
		});
		const stale = seenOf(c.draft);
		expect(await act(songPage.actions.tap, ev('u2', c.draft, { t: '12', seen: stale }))).toEqual({
			ok: true
		});
		expect(JSON.parse(getSong(db, c.draft)!.anchorsJson)).toHaveLength(1);
		// Someone tapped since: the old `seen` is a clash, and nothing is written.
		expect(
			await act(songPage.actions.tap, ev('u2', c.draft, { t: '30', seen: stale }))
		).toMatchObject({ status: 409 });
		expect(JSON.parse(getSong(db, c.draft)!.anchorsJson)).toHaveLength(1);
		expect(history(db, 1, 'song', c.draft).map((r) => r.verb)).toContain('edit');
	});

	it('refuses an editor’s section write or Undo made on an older version, and logs the rest', async () => {
		const stale = seenOf(c.draft);
		expect(
			await act(songPage.actions.sectionAdd, ev('u2', c.draft, { beat: '0', seen: stale }))
		).toEqual({ ok: true, index: 0 });
		expect(history(db, 1, 'song', c.draft)[0]).toMatchObject({ verb: 'edit', subject: 'sections' });
		// The section changed the song since `stale`: both are a clash, and nothing is written.
		const before = getSong(db, c.draft)!.sectionsJson;
		expect(
			await act(songPage.actions.sectionAdd, ev('u2', c.draft, { beat: '8', seen: stale }))
		).toMatchObject({ status: 409 });
		expect(
			await act(
				songPage.actions.restore,
				ev('u2', c.draft, { field: 'sections', value: '[]', seen: stale })
			)
		).toMatchObject({ status: 409 });
		expect(getSong(db, c.draft)!.sectionsJson).toBe(before);
	});

	it('saves an editor’s details with `seen`, logged', async () => {
		const seen = seenOf(c.draft);
		expect(
			await act(
				songPage.actions.update,
				ev('u2', c.draft, { title: 'Renamed', artist: '', style: 'salsa', seen })
			)
		).toEqual({ ok: true });
		expect(getSong(db, c.draft)!.title).toBe('Renamed');
		expect(history(db, 1, 'song', c.draft)[0]).toMatchObject({ verb: 'edit', actorId: 'u2' });
	});

	it('an editor’s Share puts it in members’ Music, marked new', async () => {
		expect(musicAs('u3').groups.flatMap((g) => g.songs.map((s) => s.id))).toEqual([c.shared]);
		expect(await act(songPage.actions.share, ev('u2', c.draft))).toEqual({ ok: true });
		const groups = musicAs('u3').groups;
		expect(groups.map((g) => g.team.name)).toEqual(['Salsa Tuesdays']);
		expect(groups[0].songs.find((s) => s.id === c.draft)).toMatchObject({ isNew: true });
		expect(songPageAs('u3', c.draft).canEdit).toBe(false);
	});

	it('Stop sharing and Delete take it from members', async () => {
		expect(await act(songPage.actions.unshare, ev('u2', c.shared))).toEqual({ ok: true });
		expect(musicAs('u3').groups).toEqual([]);
		expect(await act(songPage.actions.delete, ev('u2', c.draft))).toMatchObject({
			status: 303,
			location: '/salsa/songs'
		});
		expect(getSong(db, c.draft)!.archivedAt).not.toBeNull();
		expect(history(db, 1, 'song', c.draft)[0].verb).toBe('delete');
	});

	it('a member’s Edit offers Make it mine; an editor’s does not', () => {
		expect(songPageAs('u3', c.shared).makeMine).toMatchObject({
			label: 'Chan Chan',
			team: 'Salsa Tuesdays',
			bytes: 1000
		});
		expect(songPageAs('u2', c.shared).makeMine).toBeNull();
		expect(songPage.actions).not.toHaveProperty('copy');
	});

	it('Make it mine makes a personal song and opens it', async () => {
		const done = (await act(songPage.actions.makeMine, ev('u3', c.shared))) as {
			status: number;
			location: string;
		};
		expect(done.status).toBe(303);
		const id = Number(done.location.split('/').pop());
		expect(done.location).toBe(`/salsa/songs/${id}`);
		expect(getSong(db, id)).toMatchObject({ userId: 'u3', teamId: null, title: 'Chan Chan' });
		expect(songPageAs('u3', id).canEdit).toBe(true);
	});

	it('Make it mine on a song whose copy I archived says what to do', async () => {
		const done = (await act(songPage.actions.makeMine, ev('u3', c.shared))) as { location: string };
		archiveSong(db, Number(done.location.split('/').pop()), 5);
		expect(await act(songPage.actions.makeMine, ev('u3', c.shared))).toMatchObject({
			status: 409,
			data: { action: 'makeMine', askForMore: false, message: archivedSongCopy() }
		});
	});

	it('Make it mine is refused at the person’s limit, asking for more', async () => {
		db.update(users).set({ storageLimitBytes: 10 }).where(eq(users.id, 'u3')).run();
		expect(await act(songPage.actions.makeMine, ev('u3', c.shared))).toMatchObject({
			status: 413,
			data: { action: 'makeMine', askForMore: true }
		});
	});
});

describe('Music', () => {
	it('outside group mode: the person’s songs, then each group’s shared ones', () => {
		const music = musicAs('u2');
		expect(music.songs).toEqual([]);
		expect(music.groups.map((g) => [g.team.name, g.songs.map((s) => s.id)])).toEqual([
			['Salsa Tuesdays', [c.shared]]
		]);
	});

	it('in group mode: the group’s songs, drafts first, and how many use each', () => {
		const music = musicAs('u2', 1);
		expect(music.songs.map((s) => s.id)).toEqual([c.draft, c.shared]);
		expect(music.groups).toEqual([]);
		expect(music.users[c.shared]).toBe(0);
	});

	it('leaves a former member’s Music', async () => {
		await leaveTeam(db, 1, 'u3', { mode: 'all' }, NO_FILES, CLASS_T + 1);
		expect(musicAs('u3').groups).toEqual([]);
	});
});

describe('the group page’s class songs', () => {
	type GroupPage = { songs: { id: number; isNew: boolean; draft: boolean }[] };
	const groupAs = (as: string) =>
		(groupLoad as unknown as (e: unknown) => GroupPage)({
			params: { dance: 'salsa', id: '1' },
			locals: { user: user(as) },
			url: new URL('http://localhost/salsa/groups/1')
		});

	it('shows a member the shared ones, new until opened', async () => {
		expect(groupAs('u3').songs).toEqual([
			expect.objectContaining({ id: c.shared, isNew: true, draft: false })
		]);
	});

	it('shows an editor the drafts too, marked', () => {
		expect(groupAs('u2').songs.map((s) => [s.id, s.draft])).toEqual([
			[c.draft, true],
			[c.shared, false]
		]);
	});
});

describe('opening a group song', () => {
	const open = (as: string, id: number) =>
		status(() =>
			(postOpen as unknown as (e: unknown) => Promise<Response>)({
				request: new Request('http://localhost/api/opens', {
					method: 'POST',
					body: JSON.stringify({ kind: 'song', id })
				}),
				locals: { user: user(as) }
			})
		);
	type Groups = { teams: { id: number; newCount: number }[] };
	const groupsAs = (as: string) =>
		(groupsLoad as unknown as (e: unknown) => Groups)({
			params: { dance: 'salsa' },
			locals: { user: user(as) }
		}).teams.find((t) => t.id === 1)!.newCount;

	it('clears its New for a member, and the Groups count drops', async () => {
		const before = groupsAs('u3');
		expect(await open('u3', c.shared)).toBe(204);
		expect(groupsAs('u3')).toBe(before - 1);
	});
});
