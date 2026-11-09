/** Specs only: the repo's drizzle migrations, in journal order, as `migrateDevice` takes them. */
import { readFileSync } from 'node:fs';
import type { Migration } from './migrate';

const dir = new URL('../../drizzle/', import.meta.url);

export function repoMigrations(): Migration[] {
	const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', dir), 'utf8')) as {
		entries: { tag: string }[];
	};
	return journal.entries.map((e) => ({
		tag: e.tag,
		sql: readFileSync(new URL(`${e.tag}.sql`, dir), 'utf8')
	}));
}
