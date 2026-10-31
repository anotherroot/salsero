import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateAll = vi.fn(async () => {});
vi.mock('$app/navigation', () => ({ invalidateAll: () => invalidateAll() }));
vi.mock('$app/forms', () => ({
	deserialize: (text: string) => JSON.parse(text)
}));

const { restoreSet } = await import('./restore-set');

describe('restoreSet', () => {
	const fetchMock = vi.fn();
	beforeEach(() => {
		invalidateAll.mockClear();
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});
	afterEach(() => vi.unstubAllGlobals());

	const answer = (body: unknown) => ({ text: async () => JSON.stringify(body) });

	it('posts the snapshot to ?/restoreSet as an action, reloads, and says it worked', async () => {
		fetchMock.mockResolvedValue(answer({ type: 'success', status: 200, data: {} }));
		expect(await restoreSet('{"exerciseId":1}')).toBe(true);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('?/restoreSet');
		expect(init.method).toBe('POST');
		expect(init.headers['x-sveltekit-action']).toBe('true');
		expect((init.body as FormData).get('snapshot')).toBe('{"exerciseId":1}');
		expect(invalidateAll).toHaveBeenCalledOnce();
	});

	it('a refusal is false, and still reloads: the server wins', async () => {
		fetchMock.mockResolvedValue(answer({ type: 'failure', status: 404, data: {} }));
		expect(await restoreSet('x')).toBe(false);
		expect(invalidateAll).toHaveBeenCalledOnce();
	});

	it('an unreachable server is false, with nothing to reload', async () => {
		fetchMock.mockRejectedValue(new TypeError('offline'));
		expect(await restoreSet('x')).toBe(false);
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});
