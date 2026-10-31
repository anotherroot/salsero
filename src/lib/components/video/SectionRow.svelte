<!-- src/lib/components/video/SectionRow.svelte -->
<script lang="ts">
	import { lengthText, spotLabel } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * Portrait's sections in one row: All (the full list, with Edit on each
	 * card) and then every spot in time order. The open section is lit and
	 * kept in view, so the next one is one tap away.
	 */
	interface Props {
		spots: Spot[];
		activeId: number | null;
		loadFailed: boolean;
		onopen: (spot: Spot) => void;
		onall: () => void;
	}

	let { spots, activeId, loadFailed, onopen, onall }: Props = $props();

	let row = $state<HTMLDivElement>();
	let scrolled = $state(false);

	$effect(() => {
		void activeId;
		row
			?.querySelector('[aria-current="true"]')
			?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});

	const PILL = 'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] whitespace-nowrap';
</script>

{#if loadFailed}
	<p role="alert" class="flex items-center gap-2 px-5 pt-1 text-[13px] font-bold text-danger">
		<Icon name="warning" size={16} />Couldn't load spots
	</p>
{:else if spots.length === 0}
	<p class="px-5 pt-0.5 text-[13px] leading-[1.45] text-muted">
		Nothing marked yet. <b class="font-bold text-ink-2">Mark point</b> saves this moment;
		<b class="font-bold text-ink-2">Start section</b> saves a stretch to loop.
	</p>
{:else}
	<div
		bind:this={row}
		role="group"
		aria-label="Sections and points"
		class="row flex gap-2 overflow-x-auto px-4"
		class:scrolled
		onscroll={(e) => (scrolled = e.currentTarget.scrollLeft > 0)}
	>
		<button type="button" class="h-11 flex-none cursor-pointer" onclick={onall}>
			<span class="{PILL} bg-chip font-semibold text-chip-ink">
				<Icon name="list" size={16} />All
				<span class="font-bold tabular-nums opacity-75">{spots.length}</span>
			</span>
		</button>
		{#each spots as s (s.id)}
			{@const on = s.id === activeId}
			<button
				type="button"
				class="h-11 flex-none cursor-pointer"
				aria-current={on ? 'true' : undefined}
				onclick={() => onopen(s)}
			>
				<span
					class="{PILL} {on
						? 'bg-accent font-extrabold text-on-accent'
						: 'bg-chip font-semibold text-chip-ink'}"
				>
					<Icon name={s.endMs === null ? 'flag' : 'repeat'} size={16} />
					<span class="max-w-40 truncate">{spotLabel(s)}</span>
					{#if s.endMs !== null}
						<span class="font-bold tabular-nums opacity-75">{lengthText(s.endMs - s.startMs)}</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.row {
		scrollbar-width: none;
		mask-image: linear-gradient(90deg, black 86%, transparent);
	}
	.row.scrolled {
		mask-image: linear-gradient(90deg, transparent, black 10%, black 86%, transparent);
	}
</style>
