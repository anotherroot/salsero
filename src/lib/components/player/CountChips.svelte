<script lang="ts">
	import { COUNT_PATTERN_LABEL, type CountPattern } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';

	interface Props {
		patterns: readonly CountPattern[];
		value: CountPattern;
		onchange: (pattern: CountPattern) => void;
		name?: string;
		/** The radio group's accessible name. */
		label: string;
		/** One row that scrolls sideways instead of wrapping. */
		scroll?: boolean;
	}

	let { patterns, value, onchange, name = 'count', label, scroll = false }: Props = $props();

	let row: HTMLDivElement | undefined = $state();

	// Bring the checked chip into view once, on mount. Set on the row itself:
	// scrollIntoView would move the page too.
	$effect(() => {
		if (!scroll || !row) return;
		const on = row.querySelector<HTMLElement>('input:checked')?.parentElement;
		if (!on) return;
		const end = on.offsetLeft + on.offsetWidth;
		if (end > row.clientWidth) row.scrollLeft = end - row.clientWidth + 16; // + the row's pr-4, so the chip clears the edge
	});
</script>

<!--
	Wraps rather than sharing one row: seven options do not fit at 375 px, and a
	fast song needs the sparse ones to be as reachable as salsa. `scroll` is the
	other answer: one row, bleeding to the screen's edge.
-->
<div
	bind:this={row}
	role="radiogroup"
	aria-label={label}
	class={scroll
		? 'relative -mr-4 flex [scrollbar-width:none] flex-nowrap gap-x-2 overflow-x-auto pr-4 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
		: 'flex flex-wrap gap-x-2 gap-y-1'}
>
	{#each patterns as p (p)}
		<label class="{CHIP} min-w-11">
			<input
				type="radio"
				{name}
				checked={value === p}
				onchange={() => onchange(p)}
				class="sr-only"
			/>
			{COUNT_PATTERN_LABEL[p]}
		</label>
	{/each}
</div>
