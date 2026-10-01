import { tick } from 'svelte';
import type { Action } from 'svelte/action';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { beforeNavigate, goto } from '$app/navigation';
import { fingerprint } from './fingerprint';
import { pending, type SaveOutcome, type Unsaved } from './pending';

/*
 * The live list of what leaving would lose, and the one question the app asks
 * about it. Everything is registered from the browser (actions and effects),
 * so the module-level state never holds anything during SSR.
 */

// Not reactive on purpose: nothing renders from it; it is only asked at the
// moment something tries to leave.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const entries = new Set<Unsaved>();

/** Register something that can be unsaved. Returns the unregister. */
export function track(entry: Unsaved): () => void {
	entries.add(entry);
	return () => entries.delete(entry);
}

/** What is unsaved inside `scope` (anywhere, when null). */
export function unsaved(scope: Node | null = null, unload = false): Unsaved[] {
	return pending(entries, { scope, unload });
}

export interface Ask {
	entries: Unsaved[];
	/** A sheet asking about itself, rather than a navigation. */
	scoped: boolean;
	/** The word on the way out: Leave, Close, Skip. */
	verb: string;
	onleave: () => void;
}

/** The question on screen, if any. `UnsavedDialog` shows it. */
export const prompt = $state<{ ask: Ask | null }>({ ask: null });

/**
 * Run `onleave` now if nothing inside `scope` is unsaved; otherwise ask first,
 * and run it only when the user chooses to go.
 */
export function leaveOrAsk(scope: Node | null, onleave: () => void, verb = 'Leave'): void {
	const list = unsaved(scope);
	if (list.length === 0) onleave();
	else prompt.ask = { entries: list, scoped: scope !== null, verb, onleave };
}

let passing = false;

/**
 * Ask before any navigation that would lose something. Call once, from the
 * root layout.
 *
 * A reload or closed tab can only get the browser's own prompt — no page may
 * show its own UI there. A plain (unenhanced) form post is let through: it is
 * a button pressed on purpose — Archive, Duplicate, Log out — and it reaches
 * here as an unload, indistinguishable from a reload except by the submit
 * that just happened.
 */
export function guardNavigation(): void {
	let postedAt = -Infinity;
	$effect(() => {
		const onsubmit = (e: SubmitEvent) => {
			if (!e.defaultPrevented) postedAt = performance.now();
		};
		window.addEventListener('submit', onsubmit);
		return () => window.removeEventListener('submit', onsubmit);
	});

	beforeNavigate((nav) => {
		if (passing) {
			passing = false;
			return;
		}
		const unload = nav.type === 'leave';
		if (unload && performance.now() - postedAt < 1000) return;
		const list = unsaved(null, unload);
		if (list.length === 0) return;
		nav.cancel();
		const to = nav.to?.url;
		if (unload || !to) return;

		const delta = nav.type === 'popstate' ? nav.delta : undefined;
		const external = nav.willUnload;
		prompt.ask = {
			entries: list,
			scoped: false,
			verb: 'Leave',
			onleave: () => {
				passing = true;
				// Back and forward replay the history move, rather than pushing
				// the page they were heading for as a new entry.
				if (delta) history.go(delta);
				else if (external) location.href = to.href;
				// `to` is the URL the app was already heading for, resolved by then.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				else void goto(to);
			}
		};
	});
}

export interface GuardOptions {
	/** What the dialog calls this form's contents. */
	label: string;
	/**
	 * The form's own `use:enhance` callback, unchanged. Loosely typed so a
	 * route's own `SubmitFunction` (from `./$types`, narrowed to its actions)
	 * fits too.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	submit?: SubmitFunction<any, any>;
	/**
	 * Decide unsaved from more than the contents: `changed` says whether the
	 * fields differ from the last save. A finished run is unsaved even when
	 * nothing was typed.
	 */
	dirty?: (changed: boolean) => boolean;
	blocked?: () => string | null;
}

function messageOf(result: ActionResult): string {
	if (result.type === 'failure') {
		const m = (result.data as { message?: unknown } | undefined)?.message;
		if (typeof m === 'string') return m;
	}
	if (result.type === 'error') {
		const m = (result.error as { message?: unknown } | undefined)?.message;
		if (typeof m === 'string') return m;
	}
	return 'It did not save.';
}

/**
 * `use:enhance`, plus: the form counts as unsaved while its contents differ
 * from what it last saved (or first showed), and the dialog's Save can submit
 * it and hear back. Use it in place of `use:enhance` on any form whose fields
 * someone fills in; one-tap forms (a delete, a move) have nothing to lose.
 */
export const guarded: Action<HTMLFormElement, GuardOptions> = (form, initial) => {
	let opts = initial;
	/** Contents at the last save, or at first paint; null until then. */
	let saved: string | null = null;
	let sending = false;
	let waiting: ((o: SaveOutcome) => void) | null = null;

	const read = () => fingerprint(new FormData(form));
	const settle = (o: SaveOutcome) => {
		const w = waiting;
		waiting = null;
		w?.(o);
	};
	// After first paint settles: some fields are filled in by effects.
	void tick().then(() => (saved = read()));

	const submit: SubmitFunction = async (input) => {
		let cancelled = false;
		const inner = await opts.submit?.({
			...input,
			cancel: () => {
				cancelled = true;
				input.cancel();
			}
		});
		if (cancelled) {
			settle({ ok: false, message: 'It was not sent.' });
			return;
		}
		// While the request is out the form is not "unsaved": a save that
		// redirects must not be stopped by its own navigation.
		sending = true;
		return async (res) => {
			try {
				if (inner) await inner(res);
				else await res.update();
				await tick();
			} finally {
				sending = false;
			}
			const r = res.result;
			if (r.type === 'success' || r.type === 'redirect') {
				saved = read();
				settle({ ok: true, moved: r.type === 'redirect' });
			} else settle({ ok: false, message: messageOf(r) });
		};
	};

	const enhanced = enhance(form, submit);
	const untrack = track({
		get label() {
			return opts.label;
		},
		node: form,
		dirty: () => {
			if (sending || saved === null) return false;
			const changed = read() !== saved;
			return opts.dirty ? opts.dirty(changed) : changed;
		},
		blocked: () => opts.blocked?.() ?? null,
		save: () => {
			if (!form.checkValidity()) return Promise.resolve({ ok: false, invalid: form });
			return new Promise<SaveOutcome>((resolve) => {
				waiting = resolve;
				form.requestSubmit();
			});
		}
	});

	return {
		update: (next) => (opts = next),
		destroy: () => {
			untrack();
			enhanced.destroy();
		}
	};
};
