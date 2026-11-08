<script lang="ts">
	/**
	 * The long-press selection's actions, on the screen's bottom edge. A greyed
	 * action still takes a tap — to say why it is greyed, which a disabled button
	 * could not.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { claimBottom } from '$lib/nav/chrome.svelte';
	import { PAGE_WIDTH } from '$lib/nav/frame';
	import type { IconName } from '$lib/icons/icons';
	import type { SelectionAction } from '$lib/routines/selection';

	interface Props {
		count: number;
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
		count,
		blocks,
		onabove,
		onbelow,
		onduplicate,
		onextract,
		ondelete,
		height = $bindable(0)
	}: Props = $props();

	// Mounted only while a selection shows: the tab bar steps aside for it.
	claimBottom(() => true);

	let hint = $state<string | null>(null);
	// A reason belongs to the selection it was given for: tapping a second slot
	// makes "Select one slot…" stale, and the bar should not keep saying it.
	$effect(() => {
		void count;
		void blocks;
		hint = null;
	});

	const run = (why: string | null, action: () => void) => () => {
		hint = why;
		if (why === null) action();
	};
</script>

{#snippet item(
	label: string,
	icon: IconName,
	why: string | null,
	action: () => void,
	danger = false
)}
	<button
		type="button"
		aria-disabled={why !== null}
		class="flex min-h-[60px] flex-col items-center justify-center gap-[5px] rounded-[14px] px-0.5 py-1.5 text-center text-[12px] leading-[1.2] font-bold {why
			? 'text-disabled-ink'
			: danger
				? 'text-danger'
				: 'text-ink'}"
		onclick={run(why, action)}><Icon name={icon} size={24} />{label}</button
	>
{/snippet}

<!-- `--icon-knockout`: filled icons cut their details out in the bar's colour. -->
<div
	role="toolbar"
	aria-label={t().routine.selection.bar}
	bind:offsetHeight={height}
	class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] border-t border-tab-line bg-tab-bg px-2 pt-2 shadow-[0_-8px_24px_rgb(0_0_0/0.08)] [--icon-knockout:var(--color-tab-bg)] desk:left-(--pane-left) desk:max-w-none"
	style="padding-bottom: calc(8px + var(--safe-bottom)); --bar-w: {PAGE_WIDTH.one}px"
>
	<!-- On the desk the actions are centred in the pane, as wide as the page (as Coverage's bar). -->
	<div class="mx-auto desk:max-w-(--bar-w)">
		{#if hint}
			<p
				class="mx-1 mb-1.5 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] leading-[1.4] font-semibold text-ink"
				role="status"
			>
				<span class="mt-px flex-none text-warn"><Icon name="info" size={16} /></span>{hint}
			</p>
		{/if}
		<div class="grid grid-cols-5 gap-0.5">
			{@render item(t().routine.selection.above, 'add-above', blocks.above, onabove)}
			{@render item(t().routine.selection.below, 'add-below', blocks.below, onbelow)}
			{@render item(t().routine.selection.duplicate, 'copy', blocks.duplicate, onduplicate)}
			{@render item(t().routine.make.action, 'route', blocks.extract, onextract)}
			{@render item(t().common.delete, 'trash', blocks.delete, ondelete, true)}
		</div>
	</div>
</div>
