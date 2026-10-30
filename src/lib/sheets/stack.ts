/**
 * The open sheets kept in step with the browser's history: one entry per
 * sheet, so Back — Android's button and gesture, the browser's button, Esc
 * through the dialog's `cancel` — closes only the topmost one.
 *
 * The same pattern as the video player's (`src/lib/video/player-history.ts`):
 * history is the one source of truth for going down. ✕, the backdrop and Esc
 * only move history, and a sheet closes when the lower depth arrives in
 * `sync()`. Opening is the other way round — shown at once, then recorded.
 *
 * A Back between shallow entries runs no `beforeNavigate`, so the unsaved
 * question is asked here, through the sheet's `tryLeave`; if the user stays,
 * the entry Back took is pushed again.
 *
 * Back moves are deferred to the end of the task (`port.later`) so that a
 * sheet closing while another opens in the same tick (Variations → New
 * variation) hands its entry over instead of going back and pushing: a
 * `pushState` made while a `history.go` is on its way is gone over by it.
 *
 * They are also held while a navigation of the page's own is on its way
 * (`hold`): a sheet its owner closes just before a `goto` (the session's
 * Finish) must not send a Back that lands during the load — SvelteKit aborts
 * a navigation when a popstate arrives, or the Back goes over its new entry.
 * Once the navigation lands, the old page's entries are behind it anyway.
 *
 * Plain TypeScript behind an injected port, so it runs under the node test
 * project; `history.svelte.ts` wires the port to SvelteKit's shallow routing.
 */

export interface SheetPort {
	/** Push an entry holding `depth` sheets. */
	push(depth: number): void;
	go(delta: number): void;
	/**
	 * Run `fn` in a later task — after the microtasks that start a `goto`
	 * called in the same handler, so its `hold` is already in place.
	 */
	later(fn: () => void): void;
}

export interface SheetEntry {
	/** Nothing unsaved: close now. Otherwise ask, and call `leave` if the user goes. */
	tryLeave(leave: () => void): void;
	/** Close the sheet for real (its owner's onclose). */
	close(): void;
}

interface Slot {
	key: number;
	entry: SheetEntry;
	/**
	 * `going`: decided to close, waiting for history to pass its entry.
	 * `gone`: its owner already closed it; only its entry is left to pass.
	 */
	status: 'open' | 'going' | 'gone';
}

export class SheetStack {
	/** One slot per history entry above the page's own, bottom first. */
	#slots: Slot[] = [];
	/**
	 * The depth history will hold once the moves already sent have landed. It
	 * runs ahead of `sync` while a move is on its way, so a second ✕ (a double
	 * tap) never sends a second one and takes the page itself back.
	 */
	#history = 0;
	#started = false;
	#scheduled = false;
	#next = 1;
	/** Navigations on their way: Back moves wait for them. */
	#holds = new Set<object>();

	constructor(private readonly port: SheetPort) {}

	/** The depth history should end at: up to the topmost sheet still open. */
	#wanted(): number {
		let n = this.#slots.length;
		while (n > 0 && this.#slots[n - 1].status !== 'open') n--;
		return n;
	}

	#index(key: number): number {
		return this.#slots.findIndex((s) => s.key === key);
	}

	#schedule(): void {
		if (this.#scheduled) return;
		this.#scheduled = true;
		this.port.later(() => {
			this.#scheduled = false;
			this.#flush();
		});
	}

	/** Send the Back moves owed: over every entry above the topmost open sheet. */
	#flush(): void {
		if (!this.#started || this.#holds.size > 0) return;
		const wanted = this.#wanted();
		if (wanted < this.#history) {
			this.port.go(wanted - this.#history);
			this.#history = wanted;
		}
	}

	/**
	 * A navigation of the page's own (a link, a `goto`, a form) is on its way:
	 * hold Back moves until the returned release runs — when it lands, is
	 * cancelled or is aborted. Releasing twice is harmless.
	 */
	hold(): () => void {
		const token = {};
		this.#holds.add(token);
		return () => {
			if (this.#holds.delete(token)) this.#schedule();
		};
	}

	/** Push an entry for every open sheet history does not hold yet. */
	anchor(): void {
		if (!this.#started) return;
		const wanted = this.#wanted();
		while (this.#history < wanted) this.port.push(++this.#history);
	}

	/**
	 * The router is ready and history holds `depth` (a reload keeps the entry's
	 * state): record the sheets opened while hydrating, or leave a stale entry.
	 */
	start(depth: number): void {
		this.#started = true;
		const len = this.#slots.length;
		if (depth > len) {
			this.port.go(len - depth);
			this.#history = len;
			return;
		}
		this.#history = depth;
		this.anchor();
	}

	/** A sheet opened: push its entry. Returns its key. */
	open(entry: SheetEntry): number {
		// Sheets on their way out above the open ones: the new sheet takes the
		// place of the first. One already decided to close closes now.
		while (this.#slots.length > 0 && this.#slots[this.#slots.length - 1].status !== 'open') {
			const top = this.#slots.pop()!;
			if (top.status === 'going') top.entry.close();
		}
		const key = this.#next++;
		this.#slots.push({ key, entry, status: 'open' });
		// An entry not yet gone back over is reused as it is: it already says this depth.
		this.anchor();
		this.#schedule();
		return key;
	}

	/** ✕, backdrop or Escape on the top sheet: ask if needed, then go back one entry. */
	requestClose(key: number): void {
		const i = this.#index(key);
		if (i < 0 || this.#slots[i].status !== 'open') return;
		this.#slots[i].entry.tryLeave(() => this.#leave(key));
	}

	/** Decided: go back over this sheet's entry (and any above it); `sync` closes it. */
	#leave(key: number): void {
		const i = this.#index(key);
		if (i < 0 || this.#slots[i].status !== 'open') return;
		for (const s of this.#slots.slice(i)) if (s.status === 'open') s.status = 'going';
		this.#schedule();
	}

	/**
	 * The sheet closed by code (its `open` went false, or it unmounted): go
	 * back over its entry if that entry is still the top one. A no-op for a
	 * sheet this stack already closed.
	 */
	closedByOwner(key: number): void {
		const i = this.#index(key);
		if (i < 0) return;
		if (this.#slots[i].status === 'open' && i >= this.#history) {
			// It has no entry (a navigation left it behind): nothing to go back
			// over, and no place to keep. Sheets above it have none either.
			this.#slots.splice(i, 1);
			return;
		}
		this.#slots[i].status = 'gone';
		this.#schedule();
	}

	/**
	 * A navigation (not a popstate) put history on a new entry holding
	 * `depth`: the sheets' entries are behind it now, and going back over them
	 * would take the page back. Call before the old page unmounts.
	 */
	navigated(depth: number): void {
		const left = this.#slots;
		this.#slots = left.filter((s) => s.status === 'open');
		for (const s of left) if (s.status === 'going') s.entry.close();
		this.#history = depth;
		// It landed: whatever it held is moot now.
		this.#holds.clear();
		this.#schedule();
	}

	/** History now holds `depth` sheet entries: a popstate landed. */
	sync(depth: number): void {
		if (!this.#started) return;
		if (depth > this.#slots.length) {
			// Forward, or back, onto an entry no sheet owns any more.
			this.port.go(this.#slots.length - depth);
			this.#history = this.#slots.length;
			return;
		}
		while (this.#slots.length > depth) {
			const top = this.#slots[this.#slots.length - 1];
			if (top.status === 'gone') {
				this.#slots.pop();
				continue;
			}
			if (top.status === 'going') {
				this.#slots.pop();
				top.entry.close();
				continue;
			}
			// A Back nothing here asked for: the browser's, the phone's.
			let asking = true;
			let left = false;
			top.entry.tryLeave(() => {
				if (asking) left = true;
				else this.#leave(top.key);
			});
			asking = false;
			if (left) {
				this.#slots.pop();
				top.entry.close();
				continue;
			}
			// The question is up and the sheet stays: put back what Back took.
			this.#history = depth;
			this.anchor();
			return;
		}
		// A move outside the stack (the browser's button) lowers the target too.
		this.#history = Math.min(this.#history, depth);
		this.#schedule();
	}
}
