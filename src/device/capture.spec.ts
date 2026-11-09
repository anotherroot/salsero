import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => undefined };
});

import { openDb } from '$lib/server/db';
import { pull } from '$lib/server/sync/pull';
import { makeWorld } from '$lib/server/sync/test-world';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { migrateDevice } from './migrate';
import { applyPull } from './apply';
import { repoMigrations } from './test-migrations';
import { captureTriggerSql, installCapture, startCapture, stopCapture } from './capture';

let device: Database.Database;

beforeEach(() => {
	device = new Database(':memory:');
	migrateDevice(device, repoMigrations());
	installCapture(device);
});

const insertSong = (id: number, title: string) =>
	device
		.prepare(
			`INSERT INTO songs (id, status, source_url, title, created_at, user_id, dance) VALUES (?, 'ready', 'u', ?, 0, 'u1', 'salsa')`
		)
		.run(id, title);

describe('capture', () => {
	it('captures an insert, an update and a delete with before and after', () => {
		startCapture(device);
		insertSong(7, 'A');
		device.prepare(`UPDATE songs SET title = 'B' WHERE id = 7`).run();
		insertSong(8, 'C');
		device.prepare(`DELETE FROM songs WHERE id = 8`).run();
		device.pragma('foreign_keys = OFF');
		device
			.prepare(`INSERT INTO default_styles (user_id, dance, style) VALUES ('u1', 'salsa', 'on1')`)
			.run();
		const rows = stopCapture(device);
		expect(rows.map((r) => [r.tbl, r.key, r.op])).toEqual([
			['songs', '7', 'i'],
			['default_styles', '["u1","salsa"]', 'i']
		]);
		expect(rows[0].before).toBeNull();
		expect(rows[0].after).toMatchObject({ id: 7, title: 'B' });

		insertSong(9, 'D');
		startCapture(device);
		device.prepare(`UPDATE songs SET title = 'E' WHERE id = 9`).run();
		device.prepare(`DELETE FROM songs WHERE id = 7`).run();
		const next = stopCapture(device);
		expect(next).toEqual([
			{
				tbl: 'songs',
				key: '9',
				op: 'u',
				before: expect.objectContaining({ title: 'D' }),
				after: expect.objectContaining({ title: 'E' })
			},
			{
				tbl: 'songs',
				key: '7',
				op: 'd',
				before: expect.objectContaining({ title: 'B' }),
				after: null
			}
		]);
	});

	it('captures nothing while no write runs', () => {
		const server = openDb(':memory:');
		makeWorld(server);
		const out = pull(server, 'u1', { cursor: 0, schema: SCHEMA_TAG });
		if ('refused' in out) throw new Error('refused');
		applyPull(device, out);
		insertSong(99, 'outside');
		expect(device.prepare('SELECT count(*) AS n FROM capture_rows').get()).toEqual({ n: 0 });
	});

	it("rebuilds its triggers to the table's columns at every open", () => {
		device.exec('ALTER TABLE songs ADD COLUMN extra_note text');
		installCapture(device);
		startCapture(device);
		device
			.prepare(
				`INSERT INTO songs (id, status, source_url, created_at, user_id, dance, extra_note) VALUES (5, 'ready', 'u', 0, 'u1', 'salsa', 'x')`
			)
			.run();
		expect(stopCapture(device)[0].after).toMatchObject({ extra_note: 'x' });
		expect(captureTriggerSql('songs', ['id'], ['id', 'title']).length).toBeGreaterThanOrEqual(3);
	});

	it('folds what one write did to a row', () => {
		startCapture(device);
		insertSong(7, 'A');
		device.prepare(`UPDATE songs SET title = 'B' WHERE id = 7`).run();
		device.prepare(`UPDATE songs SET title = 'C' WHERE id = 7`).run();
		const rows = stopCapture(device);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ op: 'i', before: null, after: { title: 'C' } });
		expect(device.prepare('SELECT count(*) AS n FROM capture_rows').get()).toEqual({ n: 0 });
	});
});
