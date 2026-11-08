/*
 * The drizzle migrations, bundled into the device worker as text and ordered
 * by drizzle's journal: what `migrateDevice` applies at start. Vite reads the
 * files at build time; specs use `repoMigrations` (test-migrations.ts), which
 * reads them from disk, and migrations.spec checks the two agree.
 */
import journal from '../../drizzle/meta/_journal.json';
import type { Migration } from './migrate';

const files = import.meta.glob<string>('/drizzle/*.sql', {
	query: '?raw',
	eager: true,
	import: 'default'
});

export function deviceMigrations(): Migration[] {
	return journal.entries.map(({ tag }) => {
		const sql = files[`/drizzle/${tag}.sql`];
		if (sql === undefined) throw new Error(`the device bundle lacks migration ${tag}`);
		return { tag, sql };
	});
}
