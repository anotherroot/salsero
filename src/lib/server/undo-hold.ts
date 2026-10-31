/**
 * What Undo needs, remembered for a minute. The delete (a phone removed, a
 * voice take deleted) has already happened; this only holds the row, or the
 * file, until Undo asks for it or `UNDO_MS` runs out, well past the toast's
 * 6 s. It is in memory, so a restart forgets it, and Undo then says "Too late
 * to undo.". `onExpire` is where a held file is finally unlinked.
 */
export const UNDO_MS = 60_000;

export class Hold<T> {
	private held = new Map<string, { value: T; timer: ReturnType<typeof setTimeout> }>();

	constructor(
		private ttlMs: number,
		private onExpire?: (value: T) => void
	) {}

	/**
	 * `onExpire` may unlink a file. Whatever it does, a failure must not throw
	 * out of a timer (an uncaught exception would take the server down) or out
	 * of `put`, and must leave the hold usable.
	 */
	private expire(value: T): void {
		try {
			this.onExpire?.(value);
		} catch (e) {
			console.error('undo hold: onExpire failed', e);
		}
	}

	/** Hold `value` under `key`; a value already held there expires at once. */
	put(key: string, value: T): void {
		const old = this.held.get(key);
		if (old) {
			clearTimeout(old.timer);
			this.held.delete(key);
			this.expire(old.value);
		}
		const timer = setTimeout(() => {
			const cur = this.held.get(key);
			if (cur?.timer !== timer) return;
			this.held.delete(key);
			this.expire(cur.value);
		}, this.ttlMs);
		// A held value never keeps the process alive.
		(timer as { unref?: () => void }).unref?.();
		this.held.set(key, { value, timer });
	}

	/** The held value, once; null when nothing is held or it ran out. */
	take(key: string): T | null {
		const cur = this.held.get(key);
		if (!cur) return null;
		clearTimeout(cur.timer);
		this.held.delete(key);
		return cur.value;
	}
}
