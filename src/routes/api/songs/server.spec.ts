/**
 * The song upload's refusals that its row shows ("Upload failed: …"), in the
 * account's language. Refused before a byte is written, so neither `$DATA_DIR`
 * nor the database is reached; both are mocked anyway (CLAUDE.md).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATA_DIR: '/nonexistent' } }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	const db = actual.openDb(':memory:');
	return { ...actual, getDb: () => db };
});

import { MAX_RECORDING_BYTES } from '$lib/limits';
import { runInLocale } from '$lib/server/i18n-request';
import { POST } from './+server';

function upload(headers: Record<string, string>) {
	return {
		url: new URL('http://localhost/api/songs?dance=salsa'),
		request: new Request('http://localhost/api/songs?dance=salsa', {
			method: 'POST',
			headers
		}),
		locals: { user: { id: 'u1', dance: 'salsa' } }
	} as unknown as Parameters<typeof POST>[0];
}

/** What the endpoint threw: SvelteKit's `error()` carries `{ status, body }`. */
async function refusal(locale: 'en' | 'sl', headers: Record<string, string>) {
	try {
		await runInLocale(locale, () => POST(upload(headers)));
	} catch (thrown) {
		return thrown as { status: number; body: { message: string } };
	}
	throw new Error('not refused');
}

const tooLarge = {
	'content-type': 'audio/mpeg',
	'content-length': String(MAX_RECORDING_BYTES + 1)
};

describe('POST /api/songs', () => {
	it('refuses a file over the limit, in Slovenian', async () => {
		expect(await refusal('sl', tooLarge)).toMatchObject({
			status: 413,
			body: { message: 'Datoteka je večja od 95 MB.' }
		});
	});

	it('refuses a file that is not audio, in Slovenian', async () => {
		expect(await refusal('sl', { 'content-type': 'video/mp4' })).toMatchObject({
			status: 415,
			body: { message: 'Dodate lahko le zvočne datoteke.' }
		});
	});

	it('keeps the English refusal byte for byte', async () => {
		expect(await refusal('en', tooLarge)).toMatchObject({
			status: 413,
			body: { message: 'That file is larger than 95 MB.' }
		});
	});
});
