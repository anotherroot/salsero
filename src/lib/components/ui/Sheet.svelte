<script lang="ts">
	import type { Snippet } from 'svelte';
	import { leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';

	interface Props {
		title: string;
		open: boolean;
		onclose: () => void;
		children: Snippet;
		/** A Back arrow on the left in place of ×: for a level stacked in a sheet. */
		back?: () => void;
		/** Pinned under the content, a hairline above it. */
		footer?: Snippet;
		/** A muted line under the title. */
		sub?: string;
	}

	let { title, open, onclose, children, back, footer, sub }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	/** This sheet's place in the stack while it is open. Not state: nothing renders from it. */
	let key: number | null = null;

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
			key = sheetStack.open({
				tryLeave: (leave) => leaveOrAsk(d, leave, 'Close'),
				close: () => onclose()
			});
		}
		if (!open && dialog.open) {
			dialog.close();
			release();
		}
	});

	/** Closed by its owner, or unmounted while open: its entry goes too. */
	function release() {
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
		else if (dialog) leaveOrAsk(dialog, onclose, 'Close');
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => {
		// Closed by the browser itself (a close request it would not let us cancel).
		release();
		onclose();
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
		<header class="flex min-h-11 items-center gap-1 px-4 pb-1" class:pl-2={back}>
			{#if back}
				<button type="button" class={iconButton('bare')} aria-label="Back" onclick={back}>
					<Icon name="back" />
				</button>
			{/if}
			<div class="flex min-w-0 flex-1 flex-col gap-0.5" class:pl-1={!back}>
				<h2 class="font-display text-[22px] leading-tight font-extrabold text-ink">{title}</h2>
				{#if sub}<span class="text-[14px] text-muted">{sub}</span>{/if}
			</div>
			{#if !back}
				<button
					type="button"
					class="{iconButton('bare')} -mr-1.5"
					aria-label="Close"
					onclick={tryClose}
				>
					<Icon name="close" />
				</button>
			{/if}
		</header>
		<div class="body px-4 pt-3 pb-2">
			{#if open}{@render children()}{/if}
		</div>
		{#if footer}
			<div class="flex flex-col gap-2 border-t border-hairline px-4 pt-3">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>

<style>
	dialog {
		margin: auto auto 0;
		width: 100%;
		max-width: 560px;
		max-height: 88dvh;
		padding: 0;
		border: none;
		border-radius: 28px 28px 0 0;
		background: var(--color-sheet);
		color: var(--color-ink);
		box-shadow: 0 -8px 30px rgb(0 0 0 / 0.18);
		overflow: hidden;
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

	dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}

	.inner {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		padding-top: 8px;
		padding-bottom: max(env(safe-area-inset-bottom), 16px);
	}

	.grabber {
		width: 40px;
		height: 5px;
		flex: none;
		margin: 0 auto 2px;
		border-radius: 3px;
		background: var(--color-field-line);
	}

	.body {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
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
