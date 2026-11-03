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
import type { PickerSong } from '$lib/types';

const user = (id: string) => ({ id, email: `${id}@x.si`, timezone: 'Europe/Ljubljana' });

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
		leaveTeam(db, 1, 'u3', CLASS_T + 1);
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
		leaveTeam(db, 1, 'u3', CLASS_T + 1);
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
		leaveTeam(db, 1, 'u3', CLASS_T + 1);
		expect(await playerStatus(`song=${c.shared}`, 'u3')).toBe(404);
	});
});
