// Writes migration 0041's SQL: node scripts/sync-triggers.ts > drizzle/0041_change_log_triggers.sql
import { SYNCED } from '../src/lib/sync/tables.ts';
import { triggersFile } from '../src/lib/sync/triggers.ts';

process.stdout.write(triggersFile(SYNCED));
