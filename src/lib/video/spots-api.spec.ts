import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok, removeSpot, SpotsApiError } from './spots-api';

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

describe('ok', () => {
	it('carries the field a refusal names', async () => {
		const res = Response.json(
			{ message: "There's already a figure called Enchufla.", field: 'figureName' },
			{ status: 400 }
		);
		const err = await ok(res).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SpotsApiError);
		expect(err).toMatchObject({
			status: 400,
			message: "There's already a figure called Enchufla.",
			field: 'figureName'
		});
	});

	it('has no field when the refusal names none', async () => {
		const err = await ok(Response.json({ message: 'Already linked.' }, { status: 409 })).catch(
			(e: unknown) => e
		);
		expect((err as SpotsApiError).field).toBeUndefined();
	});

	it('ignores a field that is not a string', async () => {
		const err = await ok(Response.json({ message: 'No.', field: 3 }, { status: 400 })).catch(
			(e: unknown) => e
		);
		expect((err as SpotsApiError).field).toBeUndefined();
	});

	it('resolves with the response on a 2xx', async () => {
		const res = Response.json({}, { status: 200 });
		await expect(ok(res)).resolves.toBe(res);
	});
});
