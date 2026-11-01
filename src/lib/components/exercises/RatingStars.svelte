<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { nextRating } from '$lib/exercises/log-view';

	interface Props {
		question: string;
		value: number | null;
		onchange: (rating: number | null) => void;
	}

	let { question, value, onchange }: Props = $props();
</script>

<fieldset class="m-0 min-w-0 border-0 p-0">
	<legend class="block pb-1.5 pl-1 text-[13px] font-bold text-ink-2">{question}</legend>
	<input type="hidden" name="rating" value={value ?? ''} />
	<div class="flex flex-col gap-1.5">
		<div class="flex gap-1.5">
			{#each [1, 2, 3, 4, 5] as n (n)}
				{@const on = value !== null && n <= value}
				<!-- Tapping the chosen one again clears it: a rating is optional. -->
				<button
					type="button"
					aria-label="{n} of 5"
					aria-pressed={value === n}
					onclick={() => onchange(nextRating(value, n))}
					class="flex h-[52px] flex-1 cursor-pointer items-center justify-center rounded-[14px] {on
						? 'bg-accent-soft text-accent'
						: 'bg-surface text-chevron'}"
				>
					<Icon name="star" size={26} filled={on} />
				</button>
			{/each}
		</div>
		{#if value !== null}
			<span class="pl-1 text-[12px] font-bold text-muted">{value} of 5 · tap it again to clear</span
			>
		{/if}
	</div>
</fieldset>
