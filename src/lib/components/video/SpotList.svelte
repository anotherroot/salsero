<!-- src/lib/components/video/SpotList.svelte -->
<script lang="ts">
	import { lengthText, spotLabel } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN_ACCENT } from './styles';

	interface Props {
		spots: Spot[];
		/** The section whose view is open: highlighted. */
		activeId: number | null;
		loadFailed: boolean;
		/** The desktop sidebar: tighter rows, and Edit on the open section's card. */
		compact?: boolean;
		onopen: (spot: Spot) => void;
		onedit?: (spot: Spot) => void;
	}

	let { spots, activeId, loadFailed, compact = false, onopen, onedit }: Props = $props();

	/** The second line: the time again only when the first line is a name. */
	function sub(s: Spot): string {
		const kind = s.endMs === null ? 'point' : lengthText(s.endMs - s.startMs);
		return s.label ? `${spotLabel({ ...s, label: null })} · ${kind}` : kind;
	}
</script>

<div
	class="flex items-center gap-2 px-4 pt-3 pb-1.5 text-[12px] font-semibold tracking-wide text-(--pl-muted)"
>
	SECTIONS AND POINTS · {spots.length}
</div>
{#if loadFailed}
	<p class="px-4 py-2 text-[13px] text-(--pl-muted)">Couldn't load spots</p>
{:else if spots.length === 0}
	<p class="px-4 py-2 text-[13px] text-(--pl-muted)">
		Nothing marked yet. Mark point saves this moment; Start section saves a stretch to loop.
	</p>
{/if}
<ul class="flex flex-col pb-4">
	{#each spots as s (s.id)}
		{@const active = s.id === activeId}
		<li class="flex items-center gap-2 pr-3 {active ? 'bg-(--pl-surface)' : ''}">
			<button
				type="button"
				class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 pl-4 text-left hover:bg-(--pl-surface) {compact
					? 'py-1.5'
					: 'py-2'}"
				aria-current={active ? 'true' : undefined}
				onclick={() => onopen(s)}
			>
				{#if !compact}
					<span
						class="grid size-10 shrink-0 place-items-center rounded-xl {active
							? 'bg-(--pl-accent) text-(--pl-accent-ink)'
							: 'bg-(--pl-raised) text-(--pl-ink-2)'}"
					>
						<Icon d={s.endMs === null ? icons.flag : icons.loop} />
					</span>
				{/if}
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="truncate text-[15px] font-medium" class:font-semibold={active}
						>{spotLabel(s)}</span
					>
					<span class="text-[13px] text-(--pl-muted) tabular-nums">{sub(s)}</span>
					{#if s.linkedTo.length > 0}
						<span class="flex items-center gap-1 text-[12px] text-(--pl-ink-2)">
							<Icon d={icons.link} size={13} />Linked to {s.linkedTo.join(', ')}
						</span>
					{/if}
				</span>
				{#if !compact}
					<Icon d={icons.chevronRight} class="text-(--pl-faint)" />
				{/if}
			</button>
			{#if compact && active && onedit}
				<button type="button" class="{BTN_ACCENT} h-9" onclick={() => onedit?.(s)}>
					<Icon d={icons.pencil} size={16} />Edit
				</button>
			{/if}
		</li>
	{/each}
</ul>
