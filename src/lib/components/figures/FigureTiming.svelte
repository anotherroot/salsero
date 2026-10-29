<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';

	/**
	 * Which count a variation begins on, and how many counts it takes. Both are
	 * its own — a variation holds everything it is.
	 *
	 * Seeds its own state once, like `StartPositions`, so key it on the
	 * variation's id wherever it is rendered.
	 */
	let {
		startCount,
		lengthCounts
	}: {
		startCount: number;
		lengthCounts: number;
	} = $props();

	// Strings, so they bind to a radio group and a text input alike.
	let start = $state(untrack(() => String(startCount)));
	let length = $state(untrack(() => String(lengthCounts)));

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => String(i + 1));
	const shortcuts = ['4', '8', '16'];
	const chip = (on: boolean) =>
		`grid h-10 place-items-center rounded-lg border text-[15px] font-medium ${
			on ? 'border-accent bg-accent/15 text-accent' : 'border-line'
		}`;
</script>

<fieldset>
	<legend class="text-[13px] font-medium">Starts on</legend>
	<div class="mt-1 grid grid-cols-8 gap-1">
		{#each counts as n (n)}
			<label class={chip(start === n)}>
				<input
					type="radio"
					name="startCount"
					value={n}
					required
					bind:group={start}
					class="sr-only"
				/>
				{n}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class="text-[13px] font-medium" for="figure-length">Counts</label>
	<div class="mt-1 flex flex-wrap items-center gap-2">
		<input
			id="figure-length"
			type="text"
			inputmode="numeric"
			pattern="[0-9]*"
			name="lengthCounts"
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
	<p class="mt-1 text-[12px] text-muted">
		How long it takes, 1 to {MAX_LENGTH_COUNTS}. One 8-count is 8.
	</p>
</div>
