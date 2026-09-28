<script lang="ts">
	import { LABEL } from '$lib/components/ui/styles';

	interface Props {
		question: string;
		value: number | null;
		onchange: (rating: number | null) => void;
	}

	let { question, value, onchange }: Props = $props();
</script>

<fieldset>
	<legend class={LABEL}>{question}</legend>
	<input type="hidden" name="rating" value={value ?? ''} />
	<div class="flex gap-2">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<!-- Tapping the chosen one again clears it: a rating is optional. -->
			<button
				type="button"
				aria-pressed={value === n}
				onclick={() => onchange(value === n ? null : n)}
				class="h-11 flex-1 rounded-lg border text-[15px] {value !== null && n <= value
					? 'border-accent bg-accent text-accent-ink'
					: 'border-rule bg-raised text-ink-2'}">{n}</button
			>
		{/each}
	</div>
</fieldset>
