/**
 * Link from other places: one picker's search of the person's other places,
 * as the person types. Waits for a pause (`DEBOUNCE_MS`), drops an answer
 * that a newer search overtook, and says `offline` when there is no
 * connection or the server did not answer. Client-only.
 */
import { elsewhereGroups } from './elsewhere';
import { fetchElsewhere } from './elsewhere-api';
import type { PickGroup } from './model';
import type { ElsewhereKind, ElsewherePlace } from '$lib/types';

export const DEBOUNCE_MS = 300;

export class ElsewhereSearch {
	places = $state<ElsewherePlace[]>([]);
	state = $state<'loading' | 'offline' | 'ready'>('ready');
	readonly groups: PickGroup[] = $derived(elsewhereGroups(this.places));

	#timer: ReturnType<typeof setTimeout> | null = null;
	#ask: AbortController | null = null;
	#last: { into: number; kinds: ElsewhereKind[]; q: string } | null = null;

	/** Search for `q` after a pause; an empty `q` clears at once. */
	search(into: number, kinds: ElsewhereKind[], q: string) {
		const query = q.trim();
		if (
			this.#last &&
			this.#last.into === into &&
			this.#last.q === query &&
			this.#last.kinds.join() === kinds.join()
		)
			return;
		this.#stop();
		this.#last = { into, kinds, q: query };
		if (query === '') {
			this.places = [];
			this.state = 'ready';
			return;
		}
		this.state = 'loading';
		this.#timer = setTimeout(() => void this.#run(), DEBOUNCE_MS);
	}

	/** The same search again, now (after a copy moved a row into the group). */
	refresh() {
		if (!this.#last || this.#last.q === '') return;
		this.#stop();
		void this.#run();
	}

	/** Forget everything (the picker closed). */
	reset() {
		this.#stop();
		this.#last = null;
		this.places = [];
		this.state = 'ready';
	}

	#stop() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
		this.#ask?.abort();
		this.#ask = null;
	}

	async #run() {
		const last = this.#last;
		if (!last) return;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			this.places = [];
			this.state = 'offline';
			return;
		}
		const ask = new AbortController();
		this.#ask = ask;
		try {
			const places = await fetchElsewhere(last.into, last.kinds, last.q, ask.signal);
			if (ask.signal.aborted) return;
			this.places = places;
			this.state = 'ready';
		} catch {
			if (ask.signal.aborted) return;
			this.places = [];
			this.state = 'offline';
		}
	}
}
