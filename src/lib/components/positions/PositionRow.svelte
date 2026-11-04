<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { TWINS_CHIP } from '$lib/clones/twins';
	import { groupRowMeta, rowMeta, type StyleLabel } from '$lib/positions/view';
	import type { PositionListRow } from '$lib/types';

	/**
	 * One row of the Positions list: the name (and the Twins chip), then the
	 * type and counts with the one gap word that matters, or, for a group's
	 * row, the type and the lesson it came from.
	 */
	let {
		row,
		href,
		styleLabel,
		group = false
	}: { row: PositionListRow; href: string; styleLabel: StyleLabel; group?: boolean } = $props();

	const meta = $derived(group ? null : rowMeta(row, styleLabel));
	// Dead end and orphan are faults (danger); an island is cut off but not broken (warn).
	const wordClass = $derived(
		meta?.tone === 'danger' ? 'font-bold text-danger' : 'font-bold text-warn'
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
<a class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step" {href}>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
			<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{row.name}</span>
			<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
			{#if row.twins}<Badge><Icon name="link" size={14} />{TWINS_CHIP}</Badge>{/if}
		</span>
		<span class="text-[13px] leading-[1.35] text-muted">
			{#if meta}
				{meta.text}{#if meta.word}
					<span class={wordClass}>{meta.word}</span>{/if}
			{:else}
				{groupRowMeta(row, styleLabel)}
			{/if}
		</span>
	</span>
	<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
</a>
