// The change-log triggers for synced tables (src/lib/sync/tables.ts).
//
// A table newly added to SYNCED gets its triggers in a NEW custom migration,
// never in 0041 (production applied it once and never runs it again):
//   npx drizzle-kit generate --custom --name=<name>
//   node scripts/sync-triggers.ts <table>… > drizzle/<that migration>.sql
// With no table, it prints the triggers of every synced table, for reference.
import { SYNCED } from '../src/lib/sync/tables.ts';
import { triggersFile } from '../src/lib/sync/triggers.ts';

const names = process.argv.slice(2);
const unknown = names.filter((t) => !(t in SYNCED));
if (unknown.length) {
	process.stderr.write(`not synced (src/lib/sync/tables.ts): ${unknown.join(', ')}\n`);
	process.exit(1);
}
const tables = names.length ? Object.fromEntries(names.map((t) => [t, SYNCED[t]])) : SYNCED;
process.stdout.write(triggersFile(tables));
