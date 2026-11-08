import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrateDevice, readMeta } from './migrate';
import { applyPull } from './apply';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { SYNCED } from '$lib/sync/tables';
import { repoMigrations } from './test-migrations';

const names = (db: Database.Database, type: string) =>
	(db.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(type) as { name: string }[]).map(
		(r) => r.name
	);

describe('migrateDevice', () => {
	it('builds the whole schema on an empty database, with the log and id triggers', () => {
		const db = new Database(':memory:');
		const all = repoMigrations();
		expect(migrateDevice(db, all)).toBe(all.length);
		const tables = names(db, 'table');
		for (const t of Object.keys(SYNCED)) expect(tables).toContain(t);
		expect(tables).toContain('change_log');
		expect(tables).toContain('device_meta');
		const triggers = names(db, 'trigger');
		expect(triggers.some((t) => t.includes('change_log') || t.includes('log'))).toBe(true);
		expect(triggers.some((t) => t.includes('mark'))).toBe(true);
		expect(readMeta(db)).toMatchObject({ userId: null, cursor: 0, full: true });
	});

	it('applies nothing the second time', () => {
		const db = new Database(':memory:');
		const all = repoMigrations();
		migrateDevice(db, all);
		expect(migrateDevice(db, all)).toBe(0);
	});

	it('applies only the new migrations after an update, and asks for everything', () => {
		const db = new Database(':memory:');
		const all = repoMigrations();
		migrateDevice(db, all.slice(0, -1));
		applyPull(db, {
			userId: 'u1',
			cursor: 7,
			schema: SCHEMA_TAG,
			full: [],
			changed: {},
			cookies: {}
		});
		expect(readMeta(db).full).toBe(false);
		expect(migrateDevice(db, all)).toBe(1);
		expect(readMeta(db)).toMatchObject({ full: true, cursor: 7, userId: 'u1' });
	});

	it('rolls a failing migration back and records nothing for it', () => {
		const db = new Database(':memory:');
		expect(() =>
			migrateDevice(db, [
				{ tag: 'bad', sql: 'CREATE TABLE a (x);\n--> statement-breakpoint\nSELECT * FROM nope;' }
			])
		).toThrow();
		expect(names(db, 'table')).not.toContain('a');
		expect(db.prepare('SELECT count(*) AS n FROM device_migrations').get()).toEqual({ n: 0 });
	});
});
