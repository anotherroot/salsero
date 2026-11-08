/*
 * Opening the copy's storage (offline phase 2), apart from the browser so the
 * rules have specs. sqlite-shim.ts and worker.ts give it the real calls.
 */

/** The options `installOpfsSAHPoolVfs` takes that this code sets. */
export type PoolOptions = {
	name: string;
	preserveOnInitFailure: true;
	forceReinitIfPreviouslyFailed: true;
};

/** The waits between tries: the last tab's worker may still hold the files for a moment. */
export const INSTALL_RETRY_MS = [100, 300, 1000];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Installs the `opfs-sahpool` VFS, trying again after each of `delays`.
 *
 * When a tab closes, its lock and its worker's sync access handles are freed in
 * no set order, so the next tab's install can find the files still held
 * (`NoModificationAllowedError`). Every try:
 * - keeps the files when it fails (`preserveOnInitFailure`: by default a failed
 *   install deletes the whole pool, the copy with it);
 * - really tries again (`forceReinitIfPreviouslyFailed`: sqlite-wasm otherwise
 *   hands back the cached failure of the first try).
 */
export async function installWithRetry<P>(
	install: (opts: PoolOptions) => Promise<P>,
	name: string,
	delays: readonly number[] = INSTALL_RETRY_MS,
	sleep: (ms: number) => Promise<void> = wait
): Promise<P> {
	const opts: PoolOptions = {
		name,
		preserveOnInitFailure: true,
		forceReinitIfPreviouslyFailed: true
	};
	for (let i = 0; ; i++) {
		try {
			return await install(opts);
		} catch (e) {
			if (i >= delays.length) throw e;
			console.warn(`[device] the copy is busy, trying again in ${delays[i]} ms`, String(e));
			await sleep(delays[i]);
		}
	}
}

export type OpenSteps<D extends { close(): void }> = {
	/** Installs the VFS (with its retries). */
	pool: () => Promise<unknown>;
	db: () => D;
	migrate: (db: D) => void;
	/** Gives the files back without deleting anything (`pauseVfs`). */
	release: () => void;
};

/**
 * The pool, the database, the migrations. A failure after the pool is in
 * closes the database and releases the files, so another tab can open them.
 */
export async function openCopy<D extends { close(): void }>(steps: OpenSteps<D>): Promise<D> {
	await steps.pool();
	let db: D | undefined;
	try {
		db = steps.db();
		steps.migrate(db);
		return db;
	} catch (e) {
		try {
			db?.close();
			steps.release();
		} catch (releasing) {
			console.error('[device] could not give the copy back', releasing);
		}
		throw e;
	}
}
