/**
 * A new build, in one reload. The service worker answers a page load from its
 * own cache, so a reload while the old worker still controls the page draws
 * the old build again, and the new one only showed after a second round (the
 * next check, up to 5 minutes later). So once the page knows a new build is out
 * it fetches the new worker, and a reload for the new build waits until that
 * worker has taken over (it skips waiting and claims the page). Client-safe; the
 * container is passed in, so this is tested without a browser.
 */

/** The parts of a `ServiceWorkerRegistration` this needs. */
export interface RegistrationLike {
	installing: unknown | null;
	waiting: unknown | null;
	update(): Promise<unknown>;
}

/** The parts of `navigator.serviceWorker` this needs. */
export interface ContainerLike {
	getRegistration(): Promise<RegistrationLike | undefined>;
	addEventListener(type: 'controllerchange', fn: () => void): void;
	removeEventListener(type: 'controllerchange', fn: () => void): void;
}

/** How long a reload waits for the new worker: its install fetches the whole build. */
export const NEW_WORKER_WAIT_MS = 15_000;

/**
 * Asks for the newest service worker and waits until it controls this page:
 * `took-over`. Never waits for `none` (no worker, nothing newer, no
 * connection) nor `held` (the new worker waits on purpose until older changes
 * are sent: `holdsUpdate`); `timeout` after `ms`. Never rejects.
 */
export async function newWorkerReady(
	container: ContainerLike,
	ms: number
): Promise<'took-over' | 'none' | 'held' | 'timeout'> {
	let reg: RegistrationLike | undefined;
	try {
		reg = await container.getRegistration();
	} catch {
		return 'none';
	}
	if (!reg) return 'none';
	let onChange = () => {};
	// Listening before the update: a small build can take over before it resolves.
	const tookOver = new Promise<'took-over'>((resolve) => {
		onChange = () => resolve('took-over');
		container.addEventListener('controllerchange', onChange);
	});
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		try {
			await reg.update();
		} catch {
			return 'none';
		}
		if (!reg.installing) return reg.waiting ? 'held' : 'none';
		const late = new Promise<'timeout'>((resolve) => {
			timer = setTimeout(() => resolve('timeout'), ms);
		});
		return await Promise.race([tookOver, late]);
	} finally {
		clearTimeout(timer);
		container.removeEventListener('controllerchange', onChange);
	}
}

let pending: ReturnType<typeof newWorkerReady> | null = null;

/**
 * `newWorkerReady` for this page, one at a time: the call that notices a new
 * build starts it, a reload waits on the same one. Resolves at once outside a
 * browser with service workers.
 */
export function newBuildReady(): Promise<unknown> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		return Promise.resolve();
	}
	pending ??= newWorkerReady(
		navigator.serviceWorker as unknown as ContainerLike,
		NEW_WORKER_WAIT_MS
	).finally(() => {
		pending = null;
	});
	return pending;
}
