<script lang="ts">
	import Icon from './Icon.svelte';

	let { rating, size = 14 }: { rating: number; size?: number } = $props();
</script>

<span
	class="inline-flex gap-px align-[-2px] text-accent"
	role="img"
	aria-label="Rated {rating} of 5"
>
	{#each Array.from({ length: rating }, (_, k) => k) as i (i)}<Icon
			name="star"
			filled
			{size}
		/>{/each}
</span>
