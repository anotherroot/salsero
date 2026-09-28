<!-- src/lib/components/exercises/SetList.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { setSummary } from '$lib/format';
	import { timeOfDay } from '$lib/day/day';
	import type { HistorySet } from '$lib/types';

	interface Props {
		sets: HistorySet[];
		timezone: string;
	}

	let { sets, timezone }: Props = $props();
</script>

<ul class="divide-y divide-line rounded-xl border border-line">
	{#each sets as s (s.id)}
		<li class="flex items-center gap-3 px-3 py-2">
			<span class="text-[13px] text-muted tabular-nums">{timeOfDay(s.doneAt, timezone)}</span>
			<span class="min-w-0 flex-1 text-[14px]">
				{setSummary(s) || 'Set'}
				{#if s.note}<span class="block truncate text-[12px] text-muted">{s.note}</span>{/if}
			</span>
			<form method="POST" action="?/deleteSet" use:enhance>
				<input type="hidden" name="setId" value={s.id} />
				<button
					type="submit"
					class="h-9 rounded-lg px-3 text-[13px] text-danger"
					aria-label="Delete set logged at {timeOfDay(s.doneAt, timezone)}">Delete</button
				>
			</form>
		</li>
	{/each}
</ul>
