<script lang="ts">
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * Today's pane while the exercise it opens by itself is on the way (desktop,
	 * board `today--a-loading`): the title and its line, then the two columns of
	 * the open exercise, the log form's cards on the left and the reference's on
	 * the right. From the pane's top, like the pane it stands for.
	 */
	const LEFT = [
		[70, 18],
		[56, 14],
		[52, 14]
	];
	const RIGHT = [
		[60, 16],
		[70, 16],
		[120, 16]
	];
</script>

{#snippet bones(list: number[][])}
	<div class="flex flex-col gap-3">
		{#each list as [h, r], i (i)}
			<span class="bone block w-full" style="height: {h}px; border-radius: {r}px"></span>
		{/each}
	</div>
{/snippet}

{#snippet left()}{@render bones(LEFT)}{/snippet}
{#snippet right()}{@render bones(RIGHT)}{/snippet}

<section aria-label={t().common.loading} aria-busy="true" class="px-10 pt-[30px] pb-10">
	<p class="sr-only" role="status">{t().common.loading}</p>
	<div class="flex flex-col gap-3.5" aria-hidden="true">
		<span class="bone block h-[26px] w-[260px] rounded-[10px]"></span>
		<span class="bone block h-3 w-[200px] rounded-md"></span>
		<span class="block h-[18px]"></span>
		<PaneColumns ratio="1:1" class="gap-3" {left} {right} />
	</div>
</section>
