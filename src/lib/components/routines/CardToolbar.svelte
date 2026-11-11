<script lang="ts">
	/**
	 * A lifted card's toolbar (spec 2026-11-11, routine lift): equal cells
	 * across the card's foot, hairlines above and between, icon over label.
	 * The open slot's (length, alternative, before, after) and the selection's
	 * (before, after, duplicate, make routine, delete). A greyed cell still
	 * takes a tap — to say why, in a line above the cells, which a disabled
	 * button could not.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { ToolItem } from './types';

	interface Props {
		/** The toolbar's accessible name. */
		label: string;
		items: ToolItem[];
		/** A hairline above the cells: under a card, not on a piece of its own. */
		edge?: boolean;
	}

	let { label, items, edge = true }: Props = $props();

	let hint = $state<string | null>(null);
	// A reason belongs to the toolbar it was given for: a new selection, or a
	// slot that can take an alternative now, makes it stale.
	$effect(() => {
		void items;
		hint = null;
	});
</script>

{#if hint}
	<p
		class="mx-3 mt-3 mb-1 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] leading-[1.4] font-semibold text-ink"
		role="status"
	>
		<span class="mt-px flex-none text-warn"><Icon name="info" size={16} /></span>{hint}
	</p>
{/if}
<div
	role="toolbar"
	aria-label={label}
	class="grid {edge ? 'border-t border-hairline' : ''}"
	style="grid-template-columns: repeat({items.length}, minmax(0, 1fr))"
>
	{#each items as item, i (item.key)}
		<button
			type="button"
			aria-label={item.name}
			aria-disabled={item.why ? true : undefined}
			class="flex h-[60px] min-w-0 cursor-pointer flex-col items-center justify-center gap-1 px-0.5 text-center text-[12px] leading-[1.15] font-extrabold active:bg-step {i >
			0
				? 'border-l border-hairline'
				: ''} {item.why ? 'text-disabled-ink' : item.danger ? 'text-danger' : 'text-accent-text'}"
			onclick={() => {
				hint = item.why ?? null;
				if (!item.why) item.onclick();
			}}><Icon name={item.icon} size={20} /><span class="line-clamp-2">{item.label}</span></button
		>
	{/each}
</div>
