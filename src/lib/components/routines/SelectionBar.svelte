<script lang="ts">
	/**
	 * The long-press selection's toolbar, docked at the screen's foot as a
	 * lifted piece of its own (spec 2026-11-11, routine lift, S8): only while
	 * the selection is not one run of neighbours — slots apart, or none yet —
	 * since a run carries the same toolbar at its own foot. The page holds the
	 * bottom for the whole selection (the tab bar steps aside), docked or not.
	 */
	import { t } from '$lib/i18n/catalog';
	import { PAGE_WIDTH } from '$lib/nav/frame';
	import type { SelectionAction } from '$lib/routines/selection';
	import CardToolbar from './CardToolbar.svelte';
	import { LIFTED } from './lift';

	interface Props {
		/** Why each action cannot run, or null when it can. */
		blocks: Record<SelectionAction, string | null>;
		onabove: () => void;
		onbelow: () => void;
		onduplicate: () => void;
		onextract: () => void;
		ondelete: () => void;
		/** The bar's rendered height, for whatever must sit above it. */
		height?: number;
	}

	let {
		blocks,
		onabove,
		onbelow,
		onduplicate,
		onextract,
		ondelete,
		height = $bindable(0)
	}: Props = $props();
</script>

<div
	bind:offsetHeight={height}
	class="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] px-3 desk:left-(--pane-left) desk:max-w-none"
	style="padding-bottom: calc(20px + var(--safe-bottom)); --bar-w: {PAGE_WIDTH.one}px"
>
	<!-- On the desk the piece is centred in the pane, as wide as the page (as Coverage's bar). -->
	<div class="pointer-events-auto mx-auto rounded-[20px] {LIFTED} desk:max-w-(--bar-w)">
		<CardToolbar
			label={t().routine.selection.bar}
			edge={false}
			items={[
				{
					key: 'above',
					label: t().routine.selection.above,
					icon: 'arrow-up',
					why: blocks.above,
					onclick: onabove
				},
				{
					key: 'below',
					label: t().routine.selection.below,
					icon: 'arrow-down',
					why: blocks.below,
					onclick: onbelow
				},
				{
					key: 'duplicate',
					label: t().routine.selection.duplicate,
					icon: 'copy',
					why: blocks.duplicate,
					onclick: onduplicate
				},
				{
					key: 'extract',
					label: t().routine.selection.make,
					icon: 'route',
					why: blocks.extract,
					onclick: onextract
				},
				{
					key: 'delete',
					label: t().common.delete,
					icon: 'trash',
					why: blocks.delete,
					danger: true,
					onclick: ondelete
				}
			]}
		/>
	</div>
</div>
