/*
 * node:async_hooks on the device. A browser has no async context, so this
 * store keeps the last value `run` set, for everything after it, whichever
 * request it belongs to.
 *
 * Its readers:
 * - the request's language (`$lib/server/i18n-request`): every request on the
 *   device is the one person's, so every request sets the same language;
 * - SvelteKit's request store (`getRequestEvent`, remote functions, paths
 *   while rendering) and Svelte's render context: read only while rendering
 *   HTML or in remote functions. The device renders no HTML (it answers page
 *   data and endpoints, `deviceAnswers`), the app has no remote functions and
 *   never calls `getRequestEvent`.
 */
export class AsyncLocalStorage<T> {
	#store: T | undefined;

	run<R, A extends unknown[]>(store: T, fn: (...args: A) => R, ...args: A): R {
		this.#store = store;
		return fn(...args);
	}

	getStore(): T | undefined {
		return this.#store;
	}
}

export default { AsyncLocalStorage };
