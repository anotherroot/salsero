<script lang="ts" module>
	/**
	 * The open sheets' dialogs, lowest first. On desktop a stacked level sits at
	 * the same place and size as the one below, so the top one draws no scrim of
	 * its own (`data-stacked`) and the one below no shadow (`data-under`): one
	 * scrim, one shadow. Only CSS under 1024 px's line reads the attributes.
	 */
	const openDialogs: HTMLDialogElement[] = [];

	function mark(): void {
		openDialogs.forEach((d, i) => {
			d.toggleAttribute('data-under', i < openDialogs.length - 1);
			d.toggleAttribute('data-stacked', i > 0 && i === openDialogs.length - 1);
		});
	}

	function track(d: HTMLDialogElement, on: boolean): void {
		const i = openDialogs.indexOf(d);
		if (on && i < 0) openDialogs.push(d);
		if (!on && i >= 0) {
			openDialogs.splice(i, 1);
			d.removeAttribute('data-under');
			d.removeAttribute('data-stacked');
		}
		mark();
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { refreshIfSent, sheetStack } from '$lib/sheets/history.svelte';
	import { followKeyboard } from '$lib/sheets/keyboard';
	import { t } from '$lib/i18n/catalog';
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';

	interface Props {
		title: string;
		open: boolean;
		onclose: () => void;
		children: Snippet;
		/** Swaps the × for a Back arrow (a level stacked over another sheet); it closes this sheet exactly as × does, through history and the unsaved-changes question. */
		back?: boolean;
		/** Pinned under the content, a hairline above it. */
		footer?: Snippet;
		/** A muted line under the title. */
		sub?: string;
		/** Drawn inside the dialog: a modal dialog makes the page inert and covers a page-level toast. */
		toast?: Snippet;
		/** A rich line under the title (wins over `sub`). The header aligns to the top. */
		subtitle?: Snippet;
		/** Header controls between the title and the ×. */
		actions?: Snippet;
		/** Fixed at 88dvh, so the footer sits at the bottom however short the body; the body ends in a fade. */
		tall?: boolean;
		/** Desktop only: a 480 px dialog (a menu, a small form) in place of 560. Below 1024 px it changes nothing. */
		size?: 'small';
		/** Desktop only: drawn 480 tall (a Link popup level), so a stacked level covers the one below. */
		level?: boolean;
	}

	let {
		title,
		open,
		onclose,
		children,
		back,
		footer,
		sub,
		toast,
		subtitle,
		actions,
		tall,
		size,
		level
	}: Props = $props();
	/** The footer's height, so the toast can sit just above it. */
	let footerH = $state(0);
	let dialog: HTMLDialogElement | undefined = $state();
	let header: HTMLElement | undefined = $state();
	/** This sheet's place in the stack while it is open. Not state: nothing renders from it. */
	let key: number | null = null;
	/** The element `track`ed, kept apart from `dialog` so an unmount can still untrack it. */
	let tracked: HTMLDialogElement | null = null;

	/*
	 * A native <dialog> opened with showModal(): focus is trapped, Escape closes,
	 * the page behind is inert, and the backdrop is the browser's own. All of
	 * that is what a bottom sheet has to get right and none of it is hand-rolled.
	 *
	 * Each open sheet holds one history entry (`$lib/sheets/stack.ts`), so Back
	 * closes the topmost sheet, not the page.
	 */
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			const d = dialog;
			track(d, true);
			tracked = d;
			// showModal focuses the first control, which may be a header action (the
			// log popup's Skip): a stray Enter would act on it. Start on × (or Back)
			// instead, unless the content asked for focus itself (`autofocus`).
			if (header?.contains(document.activeElement)) {
				header.querySelector<HTMLElement>('[data-sheet-close]')?.focus();
			}
			key = sheetStack.open({
				tryLeave: (leave) => leaveOrAsk(d, leave, t().common.close),
				close: () => {
					onclose();
					refreshIfSent();
				}
			});
		}
		if (!open && dialog.open) {
			dialog.close();
			release();
			refreshIfSent();
		}
	});

	/** While open, the sheet stays above an on-screen keyboard that covers the page (`sheets/keyboard.ts`). */
	$effect(() => {
		if (open && dialog) return followKeyboard(dialog);
	});

	/** Closed by its owner, or unmounted while open: its entry goes too. */
	function release() {
		if (tracked) track(tracked, false);
		tracked = null;
		if (key === null) return;
		const k = key;
		key = null;
		sheetStack.closedByOwner(k);
	}
	$effect(() => release);

	/**
	 * ✕, the backdrop and Escape all come here, and go back one entry exactly
	 * like Back. Anything unsaved inside the sheet (a typed form, a finished
	 * run) gets the unsaved-changes question first, so a stray tap never
	 * throws it away.
	 */
	function tryClose() {
		if (key !== null) sheetStack.requestClose(key);
		else if (dialog) leaveOrAsk(dialog, onclose, t().common.close);
	}
</script>

<dialog
	bind:this={dialog}
	class:tall
	class:small={size === 'small'}
	class:level
	aria-label={title}
	onclose={() => {
		// Closed by the browser itself (a close request it would not let us cancel).
		release();
		onclose();
		refreshIfSent();
	}}
	oncancel={(e) => {
		// Escape, on the topmost dialog only. Always ours: it goes through history.
		e.preventDefault();
		tryClose();
	}}
	onclick={(e) => {
		// A click on the backdrop lands on the dialog element itself.
		if (e.target === dialog) tryClose();
	}}
>
	<div class="inner">
		<div class="grabber" aria-hidden="true"></div>
		<header
			bind:this={header}
			class="flex min-h-11 gap-1 pr-4 pb-1 desk:pr-7 {back
				? 'pl-2 desk:pl-5'
				: 'pl-4 desk:pl-6'} {subtitle ? 'items-start' : 'items-center'}"
		>
			{#if back}
				<button
					type="button"
					class={iconButton('bare')}
					aria-label={t().common.back}
					data-sheet-close
					onclick={tryClose}
				>
					<Icon name="back" />
				</button>
			{/if}
			<div
				class="flex min-w-0 flex-1 flex-col {subtitle ? 'gap-1 pt-2' : 'gap-0.5'}"
				class:pl-1={!back}
			>
				<!-- Two lines at most: a long exercise name beside Skip and Details ran to four. The full name stays in the title and the dialog's label. -->
				<h2
					class="line-clamp-2 font-display text-[22px] leading-tight font-extrabold break-words text-ink"
					{title}
				>
					{title}
				</h2>
				{#if subtitle}{@render subtitle()}{:else if sub}<span class="text-[14px] text-muted"
						>{sub}</span
					>{/if}
			</div>
			{#if actions}{@render actions()}{/if}
			{#if !back}
				<button
					type="button"
					class="{iconButton('bare')} -mr-1.5"
					aria-label={t().common.close}
					data-sheet-close
					onclick={tryClose}
				>
					<Icon name="close" />
				</button>
			{/if}
		</header>
		<div class="body px-4 pt-3 pb-2 desk:px-7">
			<!-- Grows to fill a tall body, so the fade lands at the body's bottom, not on the last line. -->
			<div class="flex-[1_0_auto]">
				{#if open}{@render children()}{/if}
			</div>
			{#if tall}<div class="fade" aria-hidden="true"></div>{/if}
		</div>
		{#if footer}
			<div
				class="flex flex-col gap-2 border-t border-hairline px-4 pt-3 desk:px-7"
				bind:clientHeight={footerH}
			>
				{@render footer()}
			</div>
		{/if}
	</div>
	{#if toast}
		<div
			class="absolute inset-x-0"
			style:bottom={footer ? `calc(${footerH}px + max(var(--safe-bottom), 16px) + 8px)` : '16px'}
		>
			{@render toast()}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		/* Above an on-screen keyboard laid over the page (`followKeyboard`): the
		   dialog's box is the part still visible, and 88 % of that at most.
		   Without a keyboard none of the three is set. */
		top: var(--kb-top, 0px);
		bottom: var(--kb-bottom, 0px);
		margin: auto auto 0;
		width: 100%;
		max-width: 560px;
		max-height: calc(0.88 * var(--vvh, 100dvh));
		padding: 0;
		border: none;
		border-radius: 28px 28px 0 0;
		background: var(--color-sheet);
		color: var(--color-ink);
		box-shadow: 0 -8px 30px rgb(0 0 0 / 0.18);
		/* clip, not hidden: a hidden overflow can still be scrolled by focus, and a
		   focused control would slide the whole sheet off screen. Only .body scrolls. */
		overflow: clip;
	}

	dialog.tall {
		height: calc(0.88 * var(--vvh, 100dvh));
	}

	.fade {
		/* Last in the scrolling body, so it covers the content but never the scrollbar. */
		position: sticky;
		bottom: -8px; /* the body's own pb-2 */
		height: 28px;
		margin: -28px -16px 0;
		pointer-events: none;
		background: linear-gradient(to bottom, transparent, var(--color-sheet));
	}

	dialog[open] {
		display: flex;
		flex-direction: column;
		animation: rise 220ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* On a wide screen a sheet stuck to the bottom edge reads as broken. */
	@media (min-width: 640px) {
		dialog {
			margin: auto;
			border-radius: 28px;
		}
	}

	.inner {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		padding-top: 8px;
		padding-bottom: max(var(--safe-bottom), 16px);
	}

	.grabber {
		width: 40px;
		height: 5px;
		flex: none;
		margin: 0 auto 2px;
		border-radius: 3px;
		background: var(--color-track);
	}

	.body {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	/*
	 * Desktop (from 1024 px, the same line as the `desk:` variant in
	 * routes/layout.css; a component's style cannot use that variant): a centred
	 * dialog. The side padding (28) is the `desk:px-7` classes above.
	 */
	@media (width >= 1024px) {
		dialog {
			width: 560px;
			max-width: calc(100vw - 32px);
			max-height: min(780px, 100dvh - 64px);
			box-shadow: 0 24px 70px rgb(0 0 0 / 0.32);
		}

		dialog.small {
			width: 480px;
		}

		dialog.tall {
			height: min(780px, 100dvh - 64px);
		}

		dialog.level {
			height: 480px;
		}

		dialog:global([data-under]) {
			box-shadow: none;
		}

		dialog:global([data-stacked])::backdrop {
			background: transparent;
		}

		dialog[open] {
			animation-name: pop;
		}

		.grabber {
			display: none;
		}

		.inner {
			padding-top: 20px;
		}

		.fade {
			margin: -28px -28px 0;
		}
	}

	@keyframes pop {
		from {
			transform: scale(0.97);
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			transform: translateY(24px);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog[open] {
			animation: none;
		}
	}
</style>
