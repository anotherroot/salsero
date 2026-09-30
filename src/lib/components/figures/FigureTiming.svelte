<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';

	/**
	 * Which count a figure begins on, and how many counts it takes.
	 *
	 * Seeds its own state from the props once, like `StartPositions`, so it must
	 * be keyed on the figure's id wherever it is rendered.
	 */
	let { startCount, lengthCounts }: { startCount: number; lengthCounts: number } = $props();

	let start = $state(untrack(() => startCount));
	let length = $state(untrack(() => lengthCounts));

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => i + 1);
	const shortcuts = [4, 8, 16];
</script>

<fieldset>
	<legend class="text-[13px] font-medium">Starts on</legend>
	<div class="mt-1 grid grid-cols-8 gap-1">
		{#each counts as n (n)}
			<label
				class="grid h-10 place-items-center rounded-lg border text-[15px] font-medium {start === n
					? 'border-accent bg-accent/15 text-accent'
					: 'border-line'}"
			>
				<input type="radio" name="startCount" value={n} bind:group={start} class="sr-only" />
				{n}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class="text-[13px] font-medium" for="figure-length">Counts</label>
	<div class="mt-1 flex items-center gap-2">
		<input
			id="figure-length"
			type="number"
			name="lengthCounts"
			min="1"
			max={MAX_LENGTH_COUNTS}
			required
			bind:value={length}
			class="h-11 w-24 rounded-xl border border-line bg-raised px-3 text-[15px]"
		/>
		{#each shortcuts as n (n)}
			<button
				type="button"
				onclick={() => (length = n)}
				class="h-11 rounded-xl border px-3 text-[14px] {length === n
					? 'border-accent text-accent'
					: 'border-line'}">{n}</button
			>
		{/each}
	</div>
	<p class="mt-1 text-[12px] text-muted">How long the figure takes. One 8-count is 8.</p>
</div>
