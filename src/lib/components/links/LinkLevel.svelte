<!-- src/lib/components/links/LinkLevel.svelte -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	/**
	 * One level of the Link popup: the links list, or a create step. Mounted
	 * while its level is in the host's stack, so stacking follows the stack.
	 *
	 * `light`: a modal <dialog> of its own, opened on mount; the top layer puts
	 * it over whatever opened before it (the picker's Sheet, another level).
	 * `dark`: an overlay inside the full-screen player's <dialog>, `z` deep.
	 *
	 * Escape and the backdrop step one level back, unless `intercept` takes them
	 * first (the links list's "Unlink …?" question).
	 */
	interface Props {
		theme: 'light' | 'dark';
		label: string;
		/** Dark only: the overlay's z-index class. A create step sits above the picker's z-40. */
		z?: string;
		/** Escape or the backdrop; return true to keep the level. */
		intercept?: () => boolean;
		onback: () => void;
		children: Snippet;
	}

	let { theme, label, z = 'z-40', intercept, onback, children }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	/** Set while the level goes away, so its own close is not taken for an Escape. */
	let leaving = false;

	function back() {
		if (intercept?.()) return;
		onback();
	}

	onMount(() => {
		const d = dialog;
		if (theme === 'light') d?.showModal();
		// Dark: an overlay is not a top-layer dialog, so focus is moved in by hand,
		// or Escape stays with the level below it. It goes back on the way out.
		const p = panel;
		const before = document.activeElement;
		p?.focus({ preventScroll: true });
		return () => {
			leaving = true;
			if (d?.open) d.close();
			if (p && before instanceof HTMLElement && before.isConnected) {
				before.focus({ preventScroll: true });
			}
		};
	});
</script>

{#if theme === 'dark'}
	<div
		class="absolute inset-0 {z} grid place-items-center bg-black/60 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) back();
		}}
		onkeydown={(e) => {
			// Escape here, not the player's dialog's cancel: one level back.
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			back();
		}}
	>
		<div
			bind:this={panel}
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-label={label}
			class="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-(--pl-hover) bg-(--pl-surface) p-4 text-(--pl-ink) shadow-[0_16px_40px_rgb(0_0_0/0.6)] outline-none"
		>
			{@render children()}
		</div>
	</div>
{:else}
	<dialog
		bind:this={dialog}
		aria-label={label}
		oncancel={(e) => {
			if (intercept?.()) e.preventDefault();
		}}
		onclose={() => {
			// Escape closed it (natively, so a browser that will not let a second
			// Escape be cancelled still lands here once): one level back.
			if (!leaving) onback();
		}}
		onclick={(e) => {
			if (e.target === dialog) back();
		}}
	>
		<div class="max-h-[88dvh] overflow-y-auto p-4">{@render children()}</div>
	</dialog>
{/if}

<style>
	dialog {
		margin: auto;
		width: calc(100% - 32px);
		max-width: 420px;
		padding: 0;
		border: none;
		border-radius: 18px;
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.25);
	}
	dialog::backdrop {
		background: rgb(20 18 16 / 0.45);
	}
</style>
