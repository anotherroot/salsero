<!-- src/lib/components/exercises/kinds/routine/Content.svelte -->
<script lang="ts">
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import { PROSE } from '../prose';
	import type { ContentProps } from '../index';

	let { content, practice }: ContentProps = $props();
</script>

{#if content.type === 'routine'}
	<div class="flex flex-col gap-3">
		{#if content.routine.notes}
			<LinkedText text={content.routine.notes} class={PROSE} />
		{/if}
		{@render practice?.()}
		<ol class={GROUP}>
			{#each content.slots as slot, i (i)}
				<li class="flex min-h-[52px] items-center gap-3 px-4 py-2">
					<span
						class="grid size-7 flex-none place-items-center rounded-full bg-chip text-[13px] font-extrabold text-ink-2 tabular-nums"
						>{i + 1}</span
					>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[16px] font-bold">{slot.names.join(' / ')}</span>
						{#if slot.note}<span class="text-[13px] text-muted">{slot.note}</span>{/if}
					</span>
				</li>
			{/each}
		</ol>
	</div>
{/if}
