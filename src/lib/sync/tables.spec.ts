import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import { NEVER_SYNCED, SYNCED } from './tables';
import { triggersFile } from './triggers';

const tables = Object.values(schema)
	.filter((v): v is SQLiteTable => v instanceof SQLiteTable)
	.map((t) => getTableConfig(t));

describe('synced tables', () => {
	it('classifies every schema table exactly once', () => {
		const names = tables.map((t) => t.name).sort();
		const synced = Object.keys(SYNCED);
		expect(synced.filter((n) => NEVER_SYNCED.includes(n))).toEqual([]);
		expect([...synced, ...NEVER_SYNCED].sort()).toEqual(names);
	});

	it("gives every synced table its schema's key, in key order", () => {
		for (const t of tables) {
			if (!(t.name in SYNCED)) continue;
			const pk = t.primaryKeys[0]
				? t.primaryKeys[0].columns.map((c) => c.name)
				: t.columns.filter((c) => c.primary).map((c) => c.name);
			expect(SYNCED[t.name], t.name).toEqual(pk);
		}
	});

	it('migration 0040 is exactly what scripts/sync-triggers.ts writes', () => {
		const file = readFileSync('drizzle/0040_change_log_triggers.sql', 'utf8');
		expect(file).toBe(triggersFile(SYNCED));
	});
});
