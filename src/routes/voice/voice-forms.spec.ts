/**
 * My count's Undo. `getDb()` is mocked per test and `countDir` points at a
 * temp dir; nothing touches the real database or $DATA_DIR.
 */
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown, dir: '' }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
vi.mock('$lib/server/files', () => ({ countDir: () => handle.dir }));

import { openDb, type Db } from '$lib/server/db';
import { listCountTakes, putCountTake } from '$lib/server/countTakes';
import { runInLocale } from '$lib/server/i18n-request';
import { actions } from './+page.server';

const input = (file: string, phrase: 'a' | 'b' = 'a') => ({
	pattern: 'salsa' as const,
	bpm: 120,
	phrase,
	file,
	sampleRate: 44100,
	preRollS: 0.1,
	lengthS: 1,
	durationS: 1.5,
	sizeBytes: 4
});

const post = (fields: Record<string, string>) => ({
	request: new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	}),
	locals: { user: { id: 'u1' } }
});
const call = (action: unknown, fields: Record<string, string>) =>
	(action as (e: ReturnType<typeof post>) => Promise<unknown>)(post(fields));

let db: Db;

/** A take in slot 120/a with its file on disk; returns its id. */
async function seed(file: string, phrase: 'a' | 'b' = 'a') {
	await writeFile(join(handle.dir, file), 'wav!');
	putCountTake(db, 'u1', input(file, phrase));
	return listCountTakes(db, 'u1').find((t) => t.file === file)!.id;
}

beforeEach(async () => {
	db = openDb(':memory:');
	handle.db = db;
	handle.dir = await mkdtemp(join(tmpdir(), 'voice-forms-'));
});
afterEach(async () => {
	vi.useRealTimers();
	await rm(handle.dir, { recursive: true, force: true });
});

describe('delete and restore', () => {
	it('deletes the row, keeps the file, and restore brings the same file back', async () => {
		const id = await seed('a.wav');
		expect(await call(actions.delete, { id: String(id) })).toEqual({ deleted: id });
		expect(listCountTakes(db, 'u1')).toEqual([]);
		expect(existsSync(join(handle.dir, 'a.wav'))).toBe(true);

		expect(await call(actions.restore, { id: String(id) })).toEqual({ ok: true });
		const rows = listCountTakes(db, 'u1');
		expect(rows).toHaveLength(1);
		expect(rows[0].file).toBe('a.wav');
		expect(existsSync(join(handle.dir, 'a.wav'))).toBe(true);
	});

	it('Review Focus 1: after the hold runs out the file is unlinked and Undo is too late', async () => {
		vi.useFakeTimers();
		const id = await seed('a.wav');
		await call(actions.delete, { id: String(id) });
		vi.advanceTimersByTime(59_999);
		expect(existsSync(join(handle.dir, 'a.wav'))).toBe(true);
		vi.advanceTimersByTime(1);
		vi.useRealTimers();
		// The unlink is fire-and-forget on the thread pool: one tick is not enough
		// under a loaded full run, so wait for it (bounded).
		await vi.waitFor(() => expect(existsSync(join(handle.dir, 'a.wav'))).toBe(false), {
			timeout: 2000
		});

		const res = (await call(actions.restore, { id: String(id) })) as {
			status: number;
			data: { message: string };
		};
		expect(res.status).toBe(410);
		expect(res.data.message).toBe('Too late to undo.');
		expect(listCountTakes(db, 'u1')).toEqual([]);
	});

	it('Review Focus 2: a newer take wins; Undo is refused and the old file goes at once', async () => {
		const id = await seed('old.wav');
		await call(actions.delete, { id: String(id) });
		await seed('new.wav');

		const res = (await call(actions.restore, { id: String(id) })) as {
			status: number;
			data: { message: string };
		};
		expect(res.status).toBe(409);
		expect(res.data.message).toBe('A newer take holds that slot now.');
		expect(listCountTakes(db, 'u1').map((t) => t.file)).toEqual(['new.wav']);
		expect(existsSync(join(handle.dir, 'old.wav'))).toBe(false);
		expect(existsSync(join(handle.dir, 'new.wav'))).toBe(true);
	});

	it('restores once only', async () => {
		const id = await seed('a.wav');
		await call(actions.delete, { id: String(id) });
		await call(actions.restore, { id: String(id) });
		const again = (await call(actions.restore, { id: String(id) })) as { status: number };
		expect(again.status).toBe(410);
		expect(listCountTakes(db, 'u1')).toHaveLength(1);
	});

	it('refuses an unknown id as gone, and a bad one as unknown', async () => {
		const gone = (await call(actions.delete, { id: '999' })) as {
			status: number;
			data: { message: string };
		};
		expect(gone.status).toBe(404);
		expect(gone.data.message).toBe('That take is already gone.');
		const bad = (await call(actions.delete, { id: 'x' })) as { status: number };
		expect(bad.status).toBe(400);
	});
});

describe('refusals in Slovenian', () => {
	it('words each refusal in the person’s language', async () => {
		const sl = (fn: () => Promise<unknown>) => runInLocale('sl', fn);
		expect(await sl(() => call(actions.delete, { id: 'x' }))).toMatchObject({
			data: { message: 'Neznan posnetek.' }
		});
		expect(await sl(() => call(actions.delete, { id: '999' }))).toMatchObject({
			data: { message: 'Ta posnetek je že izbrisan.' }
		});
		expect(await sl(() => call(actions.restore, { id: '999' }))).toMatchObject({
			data: { message: 'Prepozno za razveljavitev.' }
		});
		const id = await seed('old.wav');
		await call(actions.delete, { id: String(id) });
		await seed('new.wav');
		expect(await sl(() => call(actions.restore, { id: String(id) }))).toMatchObject({
			data: { message: 'Na tem mestu je zdaj novejši posnetek.' }
		});
	});
});
