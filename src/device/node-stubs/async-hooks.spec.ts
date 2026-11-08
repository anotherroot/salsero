import { describe, expect, it } from 'vitest';
import { findInServer } from '$lib/server/server-sources';
import { AsyncLocalStorage } from './async-hooks';

describe("the device's AsyncLocalStorage", () => {
	it('keeps the last value set, past the call that set it', async () => {
		const store = new AsyncLocalStorage<string>();
		const seen = await store.run('sl', async () => {
			await Promise.resolve();
			return store.getStore();
		});
		expect(seen).toBe('sl');
		expect(store.getStore()).toBe('sl');
	});

	it('is safe only while no server code reads the request store', () => {
		// On the device, AsyncLocalStorage keeps the LAST value set (node-stubs/async-hooks.ts):
		// two requests at once share it. SvelteKit's request store is read through
		// `getRequestEvent` and `$app/server`; a server module using either would read
		// another request's event on the device. Read the event from the load's argument.
		expect(findInServer(/\bgetRequestEvent\b|['"]\$app\/server['"]/)).toEqual([]);
	});
});
