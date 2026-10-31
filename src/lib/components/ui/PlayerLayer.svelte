<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { IconName } from '$lib/icons/icons';
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';

	/**
	 * A sheet or a question inside the full-screen player's `<dialog>`: the look
	 * of `Sheet` and `Dialog`, as an overlay rather than a top-layer dialog of
	 * its own (a second modal would fight the player's history). Always the
	 * media palette (`.theme-media`), whatever the page's scheme.
	 *
	 * The panel is the root's static flex child, never positioned and never
	 * transformed, so a layer nested inside it (a field's picker in a create
	 * step) resolves `absolute inset-0` against THIS root and covers the whole
	 * player, not the panel.
	 *
	 * Escape and a click on the backdrop go one level back (`onclose`); the
	 * player's dialog never sees that Escape. Focus moves in on mount and goes
	 * back where it was on the way out.
	 */
	interface Props {
		shape?: 'sheet' | 'dialog';
		title: string;
		/** Sheet: a muted line under the title. */
		sub?: string;
		/** Sheet: a Back arrow on the left in place of × (a level stacked on another). */
		back?: boolean;
		/** Sheet: fixed at 88 % of the player, the body ending in a fade. */
		tall?: boolean;
		/** The overlay's z-index class; a layer stacked on another goes higher. */
		z?: string;
		/** Dialog: the disc above the title. */
		icon?: IconName;
		tone?: 'default' | 'danger';
		/** Dialog: the text under the title. */
		body?: string;
		/** Sheet: pinned under the body, a hairline above it. Dialog: the actions. */
		footer?: Snippet;
		children?: Snippet;
		onclose: () => void;
	}

	let {
		shape = 'sheet',
		title,
		sub,
		back,
		tall,
		z = 'z-40',
		icon,
		tone = 'default',
		body,
		footer,
		children,
		onclose
	}: Props = $props();

	const uid = $props.id();
	let panel: HTMLDivElement | undefined = $state();

	onMount(() => {
		// Not a top-layer dialog, so focus is moved in by hand, or Escape stays
		// with the level below. It goes back on the way out.
		const p = panel;
		const before = document.activeElement;
		// A layer nested in this one and mounted with it took focus first (children
		// mount before their parent): leave it there, it is the top level.
		if (!p?.contains(before)) p?.focus({ preventScroll: true });
		return () => {
			if (p && before instanceof HTMLElement && before.isConnected) {
				before.focus({ preventScroll: true });
			}
		};
	});

	/** What Tab can land on; of a radio group, only the checked one is a stop. */
	const TABBABLE =
		'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([type="radio"]), input[type="radio"]:checked:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	/**
	 * The layer is modal (aria-modal) but not a top-layer dialog, so Tab would
	 * walk on into the player beneath: wrap it inside the panel instead. A layer
	 * nested in this one handles its own Tab first and stops it here.
	 */
	function keepFocus(e: KeyboardEvent) {
		if (!panel) return;
		e.stopPropagation();
		const stops = [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(
			(el) => el.tabIndex >= 0 && el.getClientRects().length > 0
		);
		const first = stops[0];
		const last = stops.at(-1);
		const at = document.activeElement;
		if (!first || !last) {
			e.preventDefault();
			panel.focus({ preventScroll: true });
		} else if (e.shiftKey && (at === first || at === panel || !panel.contains(at))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (at === last || !panel.contains(at))) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<div
	class="absolute inset-0 {z} theme-media flex flex-col bg-black/45 {shape === 'sheet'
		? 'justify-end'
		: 'items-center justify-center p-6'}"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
	onkeydown={(e) => {
		if (e.key === 'Tab') {
			keepFocus(e);
			return;
		}
		// Escape here, not the player's dialog's cancel: one level back.
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		onclose();
	}}
>
	{#if shape === 'sheet'}
		<!-- Keep these classes in step with Sheet.svelte's dialog, header, body, fade and footer. -->
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			class="panel sheet-panel mx-auto flex max-h-[88%] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-sheet pt-2 pb-[max(env(safe-area-inset-bottom),16px)] text-ink sm:my-auto sm:rounded-[28px] {tall
				? 'h-[88%]'
				: ''}"
		>
			<div
				class="mx-auto mb-0.5 h-[5px] w-10 flex-none rounded-[3px] bg-field-line"
				aria-hidden="true"
			></div>
			<header class="flex min-h-11 items-center gap-1 px-4 pb-1" class:pl-2={back}>
				{#if back}
					<button type="button" class={iconButton('bare')} aria-label="Back" onclick={onclose}>
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
						onclick={onclose}
					>
						<Icon name="close" />
					</button>
				{/if}
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
				{#if children}{@render children()}{/if}
			</div>
			{#if tall}
				<div
					class="pointer-events-none relative -mt-7 h-7 flex-none bg-linear-to-b from-transparent to-sheet"
					aria-hidden="true"
				></div>
			{/if}
			{#if footer}
				<div class="flex flex-col gap-2 border-t border-hairline px-4 pt-3">
					{@render footer()}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Keep in step with Dialog.svelte. -->
		<div
			bind:this={panel}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="{uid}-title"
			aria-describedby={body ? `${uid}-body` : undefined}
			tabindex="-1"
			class="panel dialog-panel w-full max-w-[330px] rounded-[22px] bg-raised text-ink"
		>
			<div class="flex flex-col gap-3 px-6 pt-6 pb-4">
				{#if icon}
					<span
						class="grid size-12 place-items-center rounded-full {tone === 'danger'
							? 'bg-danger-soft text-danger'
							: 'bg-accent-soft text-accent-text'}"
					>
						<Icon name={icon} />
					</span>
				{/if}
				<h2 id="{uid}-title" class="font-display text-[22px] leading-tight font-extrabold text-ink">
					{title}
				</h2>
				{#if body}
					<p id="{uid}-body" class="text-[15px] leading-[1.45] text-ink-2">{body}</p>
				{/if}
				{#if children}{@render children()}{/if}
				{#if footer}
					<div class="mt-2 -mr-2 flex flex-wrap justify-end gap-2">{@render footer()}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Opacity only: a transform would make the panel the containing block of a nested layer. */
	.panel {
		animation: fade 150ms ease-out;
	}

	/*
	 * The panel takes focus only so Escape lands here; it is not a control, so
	 * no ring. The shadows are here, not utilities, because the global
	 * focus-visible rule (unlayered) would replace a utility's box-shadow with
	 * the halo; these outrank it.
	 */
	.panel:focus-visible {
		outline: none;
	}

	.sheet-panel {
		box-shadow: 0 -8px 30px rgb(0 0 0 / 0.18);
	}

	.dialog-panel {
		box-shadow: 0 20px 50px rgb(0 0 0 / 0.3);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}
</style>
