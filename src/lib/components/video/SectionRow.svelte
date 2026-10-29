<!-- src/lib/components/video/SectionRow.svelte -->
<script lang="ts">
	import { lengthText, spotLabel } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';

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

	$effect(() => {
		void activeId;
		row
			?.querySelector('[aria-current="true"]')
			?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});

	const CHIP =
		'inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-3.5 pl-3 text-[14px] whitespace-nowrap';
</script>

{#if loadFailed}
	<p class="px-4 py-2 text-[13px] text-(--pl-muted)">Couldn't load spots</p>
{:else if spots.length === 0}
	<p class="px-4 py-2 text-[13px] text-(--pl-muted)">
		Nothing marked yet. Mark point saves this moment; Start section saves a stretch to loop.
	</p>
{:else}
	<div bind:this={row} class="row flex gap-2 overflow-x-auto px-4 py-0.5">
		<button type="button" class="{CHIP} bg-(--pl-raised) font-medium" onclick={onall}>
			<Icon d={icons.list} size={16} />All
			<span class="text-[12px] text-(--pl-muted) tabular-nums">{spots.length}</span>
		</button>
		{#each spots as s (s.id)}
			{@const on = s.id === activeId}
			<button
				type="button"
				class="{CHIP} {on
					? 'bg-(--pl-accent) font-semibold text-(--pl-accent-ink)'
					: 'bg-(--pl-raised) font-medium'}"
				aria-current={on ? 'true' : undefined}
				onclick={() => onopen(s)}
			>
				<Icon d={s.endMs === null ? icons.flag : icons.loop} size={16} />
				<span class="max-w-40 truncate">{spotLabel(s)}</span>
				{#if s.endMs !== null}
					<span class="text-[12px] tabular-nums {on ? 'opacity-70' : 'text-(--pl-muted)'}"
						>{lengthText(s.endMs - s.startMs)}</span
					>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.row {
		scrollbar-width: none;
		mask-image: linear-gradient(90deg, #000 88%, transparent);
	}
</style>
