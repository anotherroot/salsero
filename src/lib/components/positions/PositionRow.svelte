<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GroupMark from '$lib/components/moves/GroupMark.svelte';
	import { cloneChip, twinsChip } from '$lib/clones/twins';
	import { differLabel } from '$lib/moves/sync';
	import { groupRowMeta, rowMeta, type StyleLabel } from '$lib/positions/view';
	import type { PositionListRow, TeamRef } from '$lib/types';

	/**
	 * One row of the Positions list: the name (and the Twins chip), then the
	 * type and counts with the one gap word that matters, or, for a group's
	 * row, its group (the mark), then the type and the lesson it came from.
	 * `current`: open in the pane beside the list (desktop), lit. `picked`: picked on the map beside the list,
	 * lit too (the current item of the list, not the page).
	 */
	let {
		row,
		href,
		styleLabel,
		team = null,
		current = false,
		picked = false,
		tag
	}: {
		row: PositionListRow;
		href: string;
		styleLabel: StyleLabel;
		/** A group's row: the group it is from. */
		team?: TeamRef | null;
		current?: boolean;
		picked?: boolean;
		/** "· Sreda 17:30": where a same-named copy came from (`fromTags`). */
		tag?: string;
	} = $props();

	const differ = $derived(differLabel(row.differ));
	const meta = $derived(team ? null : rowMeta(row, styleLabel));
	// Dead end and orphan are faults (danger); an island is cut off but not broken (warn).
	const wordClass = $derived(
		meta?.tone === 'danger' ? 'font-bold text-danger' : 'font-bold text-warn'
	);
</script>

<a
	class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
	class:bg-accent-soft={current || picked}
	aria-current={current ? 'page' : picked ? 'true' : undefined}
	{href}
>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
			<span class="text-[16px] leading-[1.3] font-bold break-words text-ink"
				>{row.name}{#if tag}<span class="ml-1 font-normal text-muted">{tag}</span>{/if}</span
			>
			<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
			{#if row.twins}<Badge><Icon name="link" size={14} />{twinsChip()}</Badge>{/if}
			<!-- With clones (copies in your app or a group's), as the Figures list marks them. -->
			{#if (row.copies ?? 0) > 0}<Badge><Icon name="copy" size={14} />{cloneChip()}</Badge>{/if}
		</span>
		{#if team}<GroupMark name={team.name} />{/if}
		<span class="text-[13px] leading-[1.35] text-muted">
			{#if meta}
				{meta.text}{#if meta.word}
					<span class={wordClass}>{meta.word}</span>{/if}
			{:else}
				{groupRowMeta(row, styleLabel)}
			{/if}
			{#if differ}<span class="font-bold text-warn"> · {differ}</span>{/if}
		</span>
	</span>
	<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
</a>
