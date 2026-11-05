<script lang="ts">
	import Face from './Face.svelte';
	import { FEEL_WORD, feelOf } from '$lib/schedule/feel';
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
			{SEP}<span class="inline-flex items-center gap-1 align-[-3px]"
				><Face feel={feelOf(parts.rating) ?? 'gotit'} size={15} />{FEEL_WORD[
					feelOf(parts.rating) ?? 'gotit'
				]}</span
			>{/if}{#if parts.note}
			{SEP}“{parts.note}”{/if}
	{:else}
		First time.
	{/if}
</p>
