import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { load } from './+page.server';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
});
const run = (next: string) =>
	load({
		url: new URL(`http://localhost/login?next=${encodeURIComponent(next)}`),
		parent: async () => ({ lastDance: 'salsa' })
	} as never) as Promise<{ noAccount: string | null }>;

describe('login', () => {
	it('says who to ask for an invite when the way back is a group link', async () => {
		db.insert(users)
			.values({ id: 'a', email: 'a@x.si', passwordHash: 'x', isAdmin: true, firstName: 'Tilen' })
			.run();
		expect((await run('/g/ABC')).noAccount).toBe(
			'This code only adds people who already have an account. Ask Tilen for an invite.'
		);
	});
	it('falls back to "the admin" and stays quiet for other pages', async () => {
		expect((await run('/g/ABC')).noAccount).toContain('Ask the admin for an invite');
		expect((await run('/salsa')).noAccount).toBeNull();
	});
});
