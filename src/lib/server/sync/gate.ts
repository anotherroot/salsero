/*
 * The write gate (offline phase 3). The server is one Node process on one
 * better-sqlite3 connection. A replay runs an outbox entry's action in one
 * transaction, and the action awaits (it reads its form); another request's
 * write landing during that await would join the replay's transaction, and
 * roll back with it. So every other write holds the gate shared, and a replay
 * holds it alone: it waits for the writes in flight, and writes that arrive
 * while it runs wait for it. A replay that cannot get the gate in time gives
 * up and is tried again on the next push; the person's writes never wait more
 * than one replay's length.
 */

export const GATE_WAIT_MS = 5000;

export class WriteGate {
	#inFlight = 0;
	/** Settles when the running replay is done; null while none runs. */
	#holder: Promise<void> | null = null;
	/** Called when the last shared write ends. */
	#idle: (() => void)[] = [];

	get inFlight(): number {
		return this.#inFlight;
	}

	/** Runs at once unless a replay holds the gate; then after it. */
	async shared<T>(fn: () => Promise<T>): Promise<T> {
		while (this.#holder) await this.#holder;
		this.#inFlight++;
		try {
			return await fn();
		} finally {
			this.#inFlight--;
			if (this.#inFlight === 0) {
				const wake = this.#idle;
				this.#idle = [];
				for (const w of wake) w();
			}
		}
	}

	/** Waits (up to waitMs) until no shared write runs, then runs alone. New shared writes may start while it waits. */
	async exclusive<T>(
		fn: () => Promise<T>,
		waitMs = GATE_WAIT_MS
	): Promise<{ ran: true; value: T } | { ran: false }> {
		// One timer for the whole wait: no clock is read (server code reads time through serverNow).
		let timer: ReturnType<typeof setTimeout> | undefined;
		const late = new Promise<'late'>((r) => (timer = setTimeout(() => r('late'), waitMs)));
		try {
			while (this.#inFlight > 0 || this.#holder) {
				const free = this.#holder ?? new Promise<void>((r) => this.#idle.push(r));
				if ((await Promise.race([free, late])) === 'late') return { ran: false };
			}
		} finally {
			clearTimeout(timer);
		}
		let release!: () => void;
		this.#holder = new Promise<void>((r) => (release = r));
		try {
			return { ran: true, value: await fn() };
		} finally {
			this.#holder = null;
			release();
		}
	}
}

/** The routes whose body is a file: their database write takes the gate itself. */
const UPLOADS = [
	/^\/api\/figures\/[^/]+\/recordings$/,
	/^\/api\/songs$/,
	/^\/api\/lessons\/[^/]+\/videos\/[^/]+$/,
	/^\/api\/worker\/songs\/[^/]+\/audio$/,
	/^\/api\/worker\/videos\/[^/]+\/file$/
];

/** The server's one gate. */
export const writeGate = new WriteGate();

/** Whether the hook holds the gate for this request: every write and the pull, not the push (it takes the gate per entry), never on the device or inside a replay. */
export function gatedRequest(
	method: string,
	path: string,
	onDevice: boolean,
	replay: boolean
): boolean {
	const m = method.toUpperCase();
	if (m === 'GET' || m === 'HEAD') return false;
	if (onDevice || replay) return false;
	// The push takes the gate itself, one entry at a time; the pull reads under it.
	if (path === '/api/sync/push') return false;
	// An upload holds the gate only around its database write (in the route): a slow
	// body on a weak signal must not keep every replay waiting.
	if (UPLOADS.some((re) => re.test(path))) return false;
	return true;
}
