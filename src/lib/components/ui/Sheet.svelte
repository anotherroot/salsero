<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		open: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let { title, open, onclose, children }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	/*
	 * A native <dialog> opened with showModal(): focus is trapped, Escape closes,
	 * the page behind is inert, and the backdrop is the browser's own. All of
	 * that is what a bottom sheet has to get right and none of it is hand-rolled.
	 */
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	{onclose}
	onclick={(e) => {
		// A click on the backdrop lands on the dialog element itself.
		if (e.target === dialog) onclose();
	}}
>
	<div class="inner">
		<header class="mb-3 flex items-center justify-between gap-3">
			<h2 class="text-[16px] font-semibold">{title}</h2>
			<button
				type="button"
				class="-mr-2 grid size-10 place-items-center rounded-full text-[20px] text-muted"
				aria-label="Close"
				onclick={onclose}>×</button
			>
		</header>
		{#if open}{@render children()}{/if}
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
		border-top: 1px solid var(--color-line);
		border-radius: 18px 18px 0 0;
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 -12px 40px rgb(0 0 0 / 0.25);
	}

	/* On a wide screen a sheet stuck to the bottom edge reads as broken. */
	@media (min-width: 640px) {
		dialog {
			margin: auto;
			border: 1px solid var(--color-line);
			border-radius: 18px;
		}
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}

	.inner {
		padding: 14px 16px max(env(safe-area-inset-bottom), 16px);
	}

	dialog[open] {
		animation: rise 220ms cubic-bezier(0.32, 0.72, 0, 1);
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
