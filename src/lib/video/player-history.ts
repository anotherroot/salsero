/**
 * The full-screen player's screens kept in step with the browser's history:
 * one entry per screen, so Back — Android's gesture, the browser's button,
 * Esc through the dialog's `cancel` — goes up exactly one level.
 *
 * History is the one source of truth for going up: `up()` and `close()` only
 * move history, and the stack changes when the new depth arrives in `sync()`.
 * Pushing is the other way round — shown at once, then recorded — because a
 * tap must open its screen immediately.
 *
 * Plain TypeScript behind an injected port, so it runs under the node test
 * project; `VideoPlayer.svelte` wires the port to SvelteKit's shallow routing
 * (`pushState`/`replaceState`, depth in `page.state.videoPlayer`). A popstate
 * between those entries is shallow to SvelteKit: it updates `page.state` and
 * runs no `beforeNavigate`, so the unsaved-changes guard never sees it.
 */
import type { Screen, Stack } from './screens';

export interface HistoryPort {
	push(depth: number): void;
	replace(depth: number): void;
	go(delta: number): void;
}

function same(a: Screen, b: Screen): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export class PlayerHistory {
	#stack: Stack = [];
	#closed = false;
	/** Screens to push once history is back down to `#pendingAt`. */
	#pending: Screen[] = [];
	#pendingAt = -1;
	/**
	 * The depth history will hold once the moves already sent have landed. It
	 * differs from the stack's length while a move is on its way, and then a
	 * second up or ✕ (a double tap, Esc twice) must not move history again: it
	 * would overshoot the player's entries and take the page itself back.
	 */
	#target = 0;

	constructor(
		private readonly port: HistoryPort,
		private readonly onchange: (stack: Stack) => void,
		private readonly onclosed: () => void
	) {}

	get stack(): Stack {
		return this.#stack;
	}

	open(initial: Stack): void {
		this.#stack = initial;
		this.#target = initial.length;
		initial.forEach((_, i) => this.port.push(i + 1));
		this.onchange(initial);
	}

	push(screen: Screen): void {
		this.#stack = [...this.#stack, screen];
		this.#target = this.#stack.length;
		this.onchange(this.#stack);
		this.port.push(this.#stack.length);
	}

	replaceTop(screen: Screen): void {
		this.#stack = [...this.#stack.slice(0, -1), screen];
		this.onchange(this.#stack);
		this.port.replace(this.#stack.length);
	}

	/** Up one level — unless a move is still on its way, which this one would add to. */
	up(): void {
		if (this.#target !== this.#stack.length || this.#target <= 0) return;
		this.#target -= 1;
		this.port.go(-1);
	}

	/** Back over every entry the player still has, counting moves already sent. */
	close(): void {
		if (this.#target <= 0) return;
		this.port.go(-this.#target);
		this.#target = 0;
	}

	/** Go to `target`: back to the part it shares with the stack, then push the rest. */
	jump(target: Stack): void {
		let common = 0;
		while (
			common < this.#stack.length &&
			common < target.length &&
			same(this.#stack[common], target[common])
		)
			common++;
		common = Math.max(1, common);
		const rest = target.slice(common);
		if (common === this.#stack.length) {
			for (const s of rest) this.push(s);
			return;
		}
		this.#pending = rest;
		this.#pendingAt = common;
		this.#target = common;
		this.port.go(common - this.#stack.length);
	}

	/** The depth history now holds (`page.state.videoPlayer`); undefined or 0 once it has left the player. */
	sync(depth: number | undefined): void {
		if (this.#closed) return;
		if (!depth) {
			this.#closed = true;
			this.onclosed();
			return;
		}
		const len = this.#stack.length;
		if (depth > len) {
			// Forward into an entry this player no longer has a screen for.
			this.port.go(len - depth);
			return;
		}
		if (depth < len) {
			this.#stack = this.#stack.slice(0, depth);
			this.onchange(this.#stack);
		}
		// A back made outside the player (the browser's button) lowers the target too.
		this.#target = Math.min(this.#target, depth);
		if (depth === this.#pendingAt) {
			const rest = this.#pending;
			this.#pending = [];
			this.#pendingAt = -1;
			for (const s of rest) this.push(s);
		}
	}
}
