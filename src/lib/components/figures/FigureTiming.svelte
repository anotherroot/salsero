<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';

	/**
	 * Which count a figure begins on, and how many counts it takes.
	 *
	 * With `inherited` — on a variation — either can be left as Basic's: the
	 * chip "Same as Basic (5)" and an empty length both post "", which the page
	 * saves as null. Seeds its own state once, like `StartPositions`, so key it
	 * on the version id wherever it is rendered.
	 */
	let {
		startCount,
		lengthCounts,
		inherited = null
	}: {
		startCount: number | null;
		lengthCounts: number | null;
		inherited?: { startCount: number; lengthCounts: number } | null;
	} = $props();

	// Strings, so "" can mean "as Basic" and still bind to a radio group.
	let start = $state(untrack(() => (startCount === null ? '' : String(startCount))));
	let length = $state(untrack(() => (lengthCounts === null ? '' : String(lengthCounts))));

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => String(i + 1));
	const shortcuts = ['4', '8', '16'];
	const chip = (on: boolean) =>
		`grid h-10 place-items-center rounded-lg border text-[15px] font-medium ${
			on ? 'border-accent bg-accent/15 text-accent' : 'border-line'
		}`;
</script>

<fieldset>
	<legend class="text-[13px] font-medium">Starts on</legend>
	{#if inherited}
		<label class="mt-1 w-full {chip(start === '')}">
			<input type="radio" name="startCount" value="" bind:group={start} class="sr-only" />
			Same as Basic ({inherited.startCount})
		</label>
	{/if}
	<div class="mt-1 grid grid-cols-8 gap-1">
		{#each counts as n (n)}
			<label class={chip(start === n)}>
				<input type="radio" name="startCount" value={n} bind:group={start} class="sr-only" />
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
			required={!inherited}
			placeholder={inherited ? `Basic: ${inherited.lengthCounts}` : undefined}
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
		{#if inherited}
			<button
				type="button"
				onclick={() => (length = '')}
				class="h-11 rounded-xl border px-3 text-[14px] {length === ''
					? 'border-accent text-accent'
					: 'border-line'}">As Basic</button
			>
		{/if}
	</div>
	<p class="mt-1 text-[12px] text-muted">
		How long it takes, 1 to {MAX_LENGTH_COUNTS}. One 8-count is 8.
	</p>
</div>
