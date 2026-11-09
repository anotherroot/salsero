import { describe, expect, it } from 'vitest';
import * as devalue from 'devalue';
import { outcomeOf } from './outcome';

const action = (body: Record<string, unknown>, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const failure = (status: number, data: Record<string, unknown>) =>
	action({ type: 'failure', status, data: devalue.stringify(data) }, status);

describe('outcomeOf', () => {
	it('reads a success and a redirect as landed', async () => {
		expect(
			await outcomeOf(
				action({ type: 'success', status: 200, data: devalue.stringify({ ok: 1 }) }),
				true
			)
		).toEqual({ landed: true });
		expect(
			await outcomeOf(action({ type: 'redirect', status: 303, location: '/x' }), true)
		).toEqual({ landed: true });
	});

	it('reads a clash, a gone, a stale and a plain refusal', async () => {
		const clash = { changed: ['name'], current: { name: 'B' }, by: 'Luka', at: 5 };
		expect(await outcomeOf(failure(409, { message: 'Changed', clash }), true)).toEqual({
			landed: false,
			reason: 'clash',
			message: 'Changed',
			clash,
			gone: null
		});
		const gone = { by: null, at: null };
		expect(await outcomeOf(failure(410, { message: 'Gone', gone }), true)).toMatchObject({
			reason: 'gone',
			gone
		});
		expect(await outcomeOf(failure(409, { message: 'Old page', stale: true }), true)).toMatchObject(
			{ reason: 'stale' }
		);
		expect(await outcomeOf(failure(400, { message: 'Pick a face' }), true)).toEqual({
			landed: false,
			reason: 'refused',
			message: 'Pick a face',
			clash: null,
			gone: null
		});
		expect(await outcomeOf(failure(403, { message: 'No' }), true)).toMatchObject({
			reason: 'access'
		});
		expect(
			await outcomeOf(action({ type: 'error', error: { message: 'Not found' } }, 404), true)
		).toMatchObject({ reason: 'gone' });
		expect(
			await outcomeOf(action({ type: 'error', error: { message: 'boom' } }, 500), true)
		).toMatchObject({ reason: 'error' });
	});

	it('reads an endpoint 2xx as landed and a 5xx as error', async () => {
		expect(await outcomeOf(new Response('{}', { status: 201 }), false)).toEqual({ landed: true });
		expect(await outcomeOf(new Response(null, { status: 204 }), false)).toEqual({ landed: true });
		expect(await outcomeOf(new Response('x', { status: 500 }), false)).toMatchObject({
			reason: 'error'
		});
		expect(await outcomeOf(action({ message: 'Taken' }, 400), false)).toMatchObject({
			reason: 'refused',
			message: 'Taken'
		});
		expect(
			await outcomeOf(
				action(
					{ message: 'Changed', clash: { changed: [], current: {}, by: null, at: null } },
					409
				),
				false
			)
		).toMatchObject({ reason: 'clash' });
		expect(await outcomeOf(action({ message: 'Old', stale: true }, 409), false)).toMatchObject({
			reason: 'stale'
		});
		expect(await outcomeOf(new Response('', { status: 404 }), false)).toMatchObject({
			reason: 'gone'
		});
		expect(await outcomeOf(new Response('', { status: 401 }), false)).toMatchObject({
			reason: 'access'
		});
	});
});
