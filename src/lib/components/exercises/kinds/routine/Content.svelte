<!-- src/lib/components/exercises/kinds/routine/Content.svelte -->
<script lang="ts">
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import type { ContentProps } from '../index';

	let { content }: ContentProps = $props();
</script>

{#if content.type === 'routine'}
	<div class="space-y-3">
		{#if content.routine.notes}
			<LinkedText text={content.routine.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		<ol class="space-y-1.5">
			{#each content.slots as slot, i (i)}
				<li class="flex gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-[14px]">
					<span class="text-muted tabular-nums">{i + 1}</span>
					<span class="min-w-0 flex-1">
						{slot.names.join(' / ')}
						{#if slot.note}<span class="block text-[12px] text-muted">{slot.note}</span>{/if}
					</span>
				</li>
			{/each}
		</ol>
	</div>
{/if}
