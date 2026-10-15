import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeSpot, SpotsApiError } from './spots-api';

afterEach(() => vi.unstubAllGlobals());

const answer = (status: number, body: unknown) =>
	vi.stubGlobal('fetch', async () => Response.json(body, { status }));

describe('removeSpot', () => {
	it('carries the server’s message on a refusal, so the player can show it', async () => {
		answer(409, { message: 'Linked to Enchufla — unlink it first.' });
		const err = await removeSpot(3).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SpotsApiError);
		expect(err).toMatchObject({ status: 409, message: 'Linked to Enchufla — unlink it first.' });
	});

	it('falls back to the status when the body says nothing', async () => {
		vi.stubGlobal('fetch', async () => new Response('', { status: 500 }));
		await expect(removeSpot(3)).rejects.toMatchObject({ status: 500, message: 'video-spots: 500' });
	});

	it('resolves on a 204', async () => {
		vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }));
		await expect(removeSpot(3)).resolves.toBeUndefined();
	});
});
