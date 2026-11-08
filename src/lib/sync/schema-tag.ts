import journal from '../../../drizzle/meta/_journal.json';

/** The newest migration's tag: a device and the server must agree on it to sync. Client-safe. */
export const SCHEMA_TAG: string = journal.entries[journal.entries.length - 1].tag;
