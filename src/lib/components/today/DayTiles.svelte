<script lang="ts">
	/*
	 * A day's numbers side by side ("7 / exercises", "30 min / practised"): Done
	 * for today and a past day.
	 */
	let { tiles }: { tiles: { value: string; label: string }[] } = $props();
</script>

<div class="flex rounded-2xl bg-surface">
	{#each tiles as tile, i (i)}
		{#if i > 0}<span aria-hidden="true" class="my-3 w-px flex-none bg-hairline"></span>{/if}
		<div class="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3">
			<span class="font-display text-[28px] leading-[1.05] font-extrabold text-ink"
				>{tile.value}</span
			>
			<span class="text-[13px] font-bold text-muted">{tile.label}</span>
		</div>
	{/each}
</div>
