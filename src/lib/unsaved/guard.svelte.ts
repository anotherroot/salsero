import { tick } from 'svelte';
import type { Action } from 'svelte/action';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { beforeNavigate, goto } from '$app/navigation';
import { refreshWhenSettled, sheetStack } from '$lib/sheets/history.svelte';
import {
	asSeen,
	changedFields,
	clashView,
	fieldLabel,
	type ClashInfo,
	type ClashView,
	canPutBack,
	kindOfShape,
	type FieldShape,
	type GoneInfo,
	type Seen
} from '$lib/clash/clash';
import { fingerprint } from './fingerprint';
import { t } from '$lib/i18n/catalog';
import {
	pending,
	sendingCount,
	stillToAsk,
	type Pass,
	type SaveOutcome,
	type Unsaved
} from './pending';

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

/** How many `use:guarded` forms have a save out: clean to `unsaved()` until it lands. */
export function sendingNow(): number {
	return sendingCount(entries);
}

export interface Ask {
	entries: Unsaved[];
	/** A sheet asking about itself, rather than a navigation. */
	scoped: boolean;
	/** The word on the way out: Leave, Close, Skip. */
	verb: string;
	/** The way out; `moved`: the dialog's Save already took the page elsewhere (a redirect). */
	onleave: (after?: { moved: boolean }) => void;
}

/** The question on screen, if any. `UnsavedDialog` shows it. */
export const prompt = $state<{ ask: Ask | null }>({ ask: null });

/**
 * Run `onleave` now if nothing inside `scope` is unsaved; otherwise ask first,
 * and run it only when the user chooses to go.
 */
export function leaveOrAsk(
	scope: Node | null,
	onleave: () => void,
	verb = t().shell.unsaved.leave
): void {
	const list = unsaved(scope);
	if (list.length === 0) onleave();
	else prompt.ask = { entries: list, scoped: scope !== null, verb, onleave };
}

/**
 * `leaveOrAsk` for a move that will navigate away from the page: ask about
 * everything the page would lose, and hand `onleave` what the user agreed to
 * lose (empty when nothing was asked), for `passNext`. A run's
 * Skip: the log form and an open settings edit are in one question.
 */
export function leavePageOrAsk(
	onleave: (answered: Unsaved[]) => void,
	verb = t().shell.unsaved.leave
): void {
	const list = unsaved(null);
	if (list.length === 0) onleave([]);
	else prompt.ask = { entries: list, scoped: false, verb, onleave: () => onleave(list) };
}

let passing = false;
/** The one navigation already answered for (`passNext`). */
let pass: Pass | null = null;

/**
 * The next navigation, when it goes to `href` (path and search, as resolved),
 * does not ask again about `answered`: the entries whose loss the user has just
 * agreed to under another verb (`leavePageOrAsk`). Anything else unsaved is
 * still asked about. Any other navigation drops the pass. Set it just before
 * the navigation (`gotoWhenSettled`'s `before`), so it cannot linger.
 */
export function passNext(href: string, answered: Unsaved[]): void {
	pass = answered.length > 0 ? { href, answered } : null;
}

/**
 * Reload the page, asking first about anything a reload would lose — an
 * upload in flight too, which an in-app navigation would not lose. Choosing
 * Reload in the dialog is the answer: the unload is let through rather than
 * asked about again by the browser.
 */
export function reloadOrAsk(): void {
	const list = unsaved(null, true);
	if (list.length === 0) location.reload();
	else
		prompt.ask = {
			entries: list,
			scoped: false,
			verb: t().shell.reload.reload,
			onleave: () => {
				passing = true;
				location.reload();
			}
		};
}

/**
 * Load `href` whole, for a navigation the guard has already let go (the user
 * answered Leave, or nothing was unsaved): the unload is not asked about again
 * by the browser. The page epoch uses it (`$lib/page-epoch.ts`).
 */
export function loadAgreed(href: string): void {
	passing = true;
	location.href = href;
}

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
		const answered = pass;
		pass = null;
		const unload = nav.type === 'leave';
		if (unload && performance.now() - postedAt < 1000) return;
		const list = stillToAsk(
			unsaved(null, unload),
			answered,
			nav.to ? nav.to.url.pathname + nav.to.url.search : null
		);
		if (list.length === 0) return;
		nav.cancel();
		const to = nav.to?.url;
		if (unload || !to) return;

		const delta = nav.type === 'popstate' ? nav.delta : undefined;
		const external = nav.willUnload;
		prompt.ask = {
			entries: list,
			scoped: false,
			verb: t().shell.unsaved.leave,
			onleave: (after) => {
				passing = true;
				// Back and forward replay the history move, rather than pushing
				// the page they were heading for as a new entry; not from where a
				// save's redirect has already moved the page.
				if (delta && !after?.moved) history.go(delta);
				else if (external) location.href = to.href;
				// `to` is the URL the app was already heading for, resolved by then.
				else void goto(to);
			}
		};
	});
}

/**
 * A guarded save the server refused because the thing changed (a clash) or
 * went (gone) since the form was opened. `ClashSheet` shows it, in the root
 * layout; what was typed is never thrown away.
 */
export interface ClashAsk {
	kind: 'clash' | 'gone';
	by: string | null;
	at: number | null;
	view: ClashView;
	/** Gone: what was typed, to copy. */
	typed: { label: string; text: string }[];
	/** Save mine: these values into their fields, then send again over theirs. */
	mine: (values: Record<string, string>) => void;
	/** Keep theirs: their values into the changed fields; yours there are dropped. */
	theirs: () => void;
}

export const clashPrompt = $state<{ ask: ClashAsk | null }>({ ask: null });

/** A form's values as a `Seen`, by field name: a repeated field's values joined by commas. */
function valuesOf(data: FormData): Seen {
	const out: Seen = {};
	for (const key of new Set(data.keys())) {
		if (key === 'seen' || key === 'fingerprint') continue;
		out[key] = data
			.getAll(key)
			.map((v) => (typeof v === 'string' ? v : v.name))
			.join(',');
	}
	return out;
}

/** What a refused save said it saw, or null when it sent none. */
function seenSent(sent: FormData): Seen | null {
	const raw = sent.get('seen');
	if (typeof raw !== 'string') return null;
	try {
		return asSeen(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * The control under one name, as a `FieldShape`: the clash check's rules
 * (`kindOfShape`, `canPutBack`) are pure and specced; this only reads the DOM.
 */
function shapeOf(form: HTMLFormElement, key: string): FieldShape {
	const el = form.elements.namedItem(key);
	if (el instanceof RadioNodeList) {
		const all = [...el];
		return all.every((r) => r instanceof HTMLInputElement && r.type === 'radio')
			? { tag: 'radios' }
			: { tag: 'many' };
	}
	if (el instanceof HTMLInputElement) return { tag: 'input', type: el.type };
	if (el instanceof HTMLTextAreaElement) return { tag: 'textarea' };
	if (el instanceof HTMLSelectElement) return { tag: 'select' };
	return { tag: 'none' };
}

/**
 * Put a value into a field as if it was typed, so bound state follows. False,
 * changing nothing, for a field a value cannot go back into (`canPutBack`).
 */
function setField(form: HTMLFormElement, key: string, value: string): boolean {
	if (!canPutBack(shapeOf(form, key))) return false;
	const el = form.elements.namedItem(key);
	let target: Element | null = null;
	if (el instanceof RadioNodeList) {
		el.value = value;
		target = [...el].find((r) => (r as HTMLInputElement).checked) ?? null;
	} else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
		el.checked = value === 'on' || value === 'true';
		target = el;
	} else if (
		el instanceof HTMLInputElement ||
		el instanceof HTMLTextAreaElement ||
		el instanceof HTMLSelectElement
	) {
		el.value = value;
		target = el;
	}
	target?.dispatchEvent(new Event('input', { bubbles: true }));
	target?.dispatchEvent(new Event('change', { bubbles: true }));
	return true;
}

/** What the form now says it saw: their version, so the next save is checked against it. */
function setSeen(form: HTMLFormElement, current: Seen): void {
	const el = form.elements.namedItem('seen');
	if (el instanceof HTMLInputElement) el.value = JSON.stringify(current);
}

/** The clash or gone a refused save carries, if any. */
function refusalOf(result: ActionResult): { clash: ClashInfo } | { gone: GoneInfo } | null {
	if (result.type !== 'failure') return null;
	const data = result.data as { clash?: ClashInfo; gone?: GoneInfo } | undefined;
	if (data?.clash) return { clash: data.clash };
	if (data?.gone) return { gone: data.gone };
	return null;
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
	/** Its save sends a message, not an edit: the question says "not sent" and offers Send. */
	sends?: boolean;
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
	return t().shell.unsaved.didNotSave;
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
			// A refusal the form shows itself (a range error) is a field to point at, not a mystery.
			settle(
				form.checkValidity() && !form.querySelector('[aria-invalid="true"]')
					? { ok: false, message: t().shell.unsaved.notSent }
					: { ok: false, invalid: form }
			);
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
				return;
			}
			const refused = refusalOf(r);
			if (refused) askClash(refused, input.formData);
			settle({ ok: false, message: messageOf(r) });
		};
	};

	/** Open the clash sheet for a refused save, holding what it sent. */
	function askClash(refused: { clash: ClashInfo } | { gone: GoneInfo }, sent: FormData) {
		const typedValues = valuesOf(sent);
		const kind = (key: string) => kindOfShape(shapeOf(form, key));
		if ('gone' in refused) {
			clashPrompt.ask = {
				kind: 'gone',
				...refused.gone,
				view: { fields: [], others: [], adopt: [] },
				typed: Object.entries(typedValues)
					.filter(([key, v]) => kind(key) !== 'other' && v)
					.map(([key, v]) => ({ label: fieldLabel(key), text: String(v) })),
				mine: () => {},
				theirs: () => (clashPrompt.ask = null)
			};
			return;
		}
		const info = refused.clash;
		const seen = seenSent(sent);
		const view = clashView(info, typedValues, seen, kind, undefined, (key) =>
			canPutBack(shapeOf(form, key))
		);
		clashPrompt.ask = {
			kind: 'clash',
			by: info.by,
			at: info.at,
			view,
			typed: [],
			mine: (values) => {
				clashPrompt.ask = null;
				// A changed field you never touched takes theirs, so Save mine
				// does not undo it; the boxes are yours.
				for (const key of view.adopt) setField(form, key, String(info.current[key] ?? ''));
				for (const [key, v] of Object.entries(values)) setField(form, key, v);
				setSeen(form, info.current);
				// Once the sheet's own Back has landed: a refresh it overtakes is dropped.
				void tick().then(() => sheetStack.settled(() => form.requestSubmit()));
			},
			theirs: () => {
				clashPrompt.ask = null;
				for (const key of info.changed) setField(form, key, String(info.current[key] ?? ''));
				setSeen(form, info.current);
				// Nothing of yours left to lose: the form is theirs again.
				const now = valuesOf(new FormData(form));
				if (changedFields(info.current, now).length === 0) saved = read();
				void tick().then(() => refreshWhenSettled());
			}
		};
	}

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
		sending: () => sending,
		get sends() {
			return opts.sends === true;
		},
		blocked: () => opts.blocked?.() ?? null,
		save: () => {
			// A `novalidate` form leaves its checks to the server, whose message shows under the field.
			if (!form.noValidate && !form.checkValidity())
				return Promise.resolve({ ok: false, invalid: form });
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
