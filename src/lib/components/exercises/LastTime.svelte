<script lang="ts">
	import { lastDoneLabel } from '$lib/format';
	import type { LastSet } from '$lib/types';

	interface Props {
		last: LastSet | null;
	}

	let { last }: Props = $props();
</script>

<p class="text-[13px] text-muted">
	{#if last}
		Last time: {lastDoneLabel(last.daysAgo)}{#if last.rating !== null}
			· {'★'.repeat(last.rating)}{/if}{#if last.note}
			· “{last.note}”{/if}
	{:else}
		First time.
	{/if}
</p>
