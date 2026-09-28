<script lang="ts">
	import { COUNT_PATTERN_LABEL, type CountPattern } from '$lib/labels';
	import { CHIP } from '$lib/components/ui/styles';

	interface Props {
		patterns: readonly CountPattern[];
		value: CountPattern;
		onchange: (pattern: CountPattern) => void;
		name?: string;
	}

	let { patterns, value, onchange, name = 'count' }: Props = $props();
</script>

<!--
	Wraps rather than sharing one row: seven options do not fit at 375 px, and a
	fast song needs the sparse ones to be as reachable as salsa.
-->
<div class="flex flex-wrap gap-2">
	{#each patterns as p (p)}
		<label class="{CHIP} min-w-[5.5rem] grow-0 basis-auto px-3">
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
