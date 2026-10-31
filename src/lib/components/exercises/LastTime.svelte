<script lang="ts">
	import Stars from '$lib/components/ui/Stars.svelte';
	import { lastTimeParts } from '$lib/exercises/log-view';
	import type { LastSet } from '$lib/types';

	interface Props {
		last: LastSet | null;
	}

	let { last }: Props = $props();
	const parts = $derived(lastTimeParts(last));
	/** A mustache, not text: Svelte trims the space a block's text starts with. */
	const SEP = ' · ';
</script>

<!-- The log popup's subtitle. A long note stops at two lines: the header is not the place to read it. -->
<p class="line-clamp-2 text-[13px] leading-[1.35] text-muted">
	{#if parts}
		{parts.when}{#if parts.rating !== null}
			{SEP}<Stars rating={parts.rating} size={13} />{/if}{#if parts.note}
			{SEP}“{parts.note}”{/if}
	{:else}
		First time.
	{/if}
</p>
