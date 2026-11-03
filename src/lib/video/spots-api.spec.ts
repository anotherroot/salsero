import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok, patchSpot, removeSpot, restoreTrashEntry, SpotsApiError } from './spots-api';

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

	it('resolves with no trash entry for a person’s spot, even on an empty answer', async () => {
		vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }));
		await expect(removeSpot(3)).resolves.toEqual({ trashId: null });
		answer(200, { trashId: null });
		await expect(removeSpot(3)).resolves.toEqual({ trashId: null });
	});

	it('hands back a group spot’s trash entry, for Undo', async () => {
		answer(200, { trashId: 12 });
		await expect(removeSpot(3)).resolves.toEqual({ trashId: 12 });
	});
});

describe('restoreTrashEntry', () => {
	it('posts to the entry, and carries a refusal’s words', async () => {
		const calls: string[] = [];
		vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
			calls.push(`${init.method} ${url}`);
			return Response.json({ message: 'Restore the video first' }, { status: 409 });
		});
		await expect(restoreTrashEntry(12)).rejects.toMatchObject({
			status: 409,
			message: 'Restore the video first'
		});
		expect(calls).toEqual(['POST /api/trash/12']);
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

describe('patchSpot', () => {
	it('sends what it saw, and a clash comes back with theirs', async () => {
		let sent: unknown = null;
		vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
			sent = JSON.parse(String(init.body));
			return Response.json(
				{
					message: 'This changed since you opened it',
					clash: { changed: ['startMs'], current: { startMs: 1500 }, by: null, at: null }
				},
				{ status: 409 }
			);
		});
		const seen = { label: null, startMs: 1000, endMs: 5000 };
		const err = await patchSpot(3, { startMs: 1100 }, seen).catch((e: unknown) => e);
		expect(sent).toEqual({ startMs: 1100, seen });
		expect(err).toMatchObject({
			status: 409,
			clash: { changed: ['startMs'], current: { startMs: 1500 } }
		});
	});
});
