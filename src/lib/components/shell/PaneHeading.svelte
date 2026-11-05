<script lang="ts">
	import { PANE_PAD, PANE_TITLE } from '$lib/components/ui/styles';
	/**
	 * The heading of a list route's pane (desktop only: the phone's list route
	 * draws no pane), drawn as an item's pane header looks (`BandHeader`'s
	 * `pane`): the title in 30/800 ink, the subtitle 15/600 muted under it. An h2:
	 * the list's band row holds the page's h1.
	 */
	let { title, subtitle }: { title: string; subtitle?: string } = $props();
</script>

<div class="flex flex-col {PANE_PAD}">
	<h2 class="font-display font-extrabold break-words text-ink {PANE_TITLE}">
		{title}
	</h2>
	{#if subtitle}
		<p class="mt-1 text-[15px] leading-[1.3] font-semibold text-muted">{subtitle}</p>
	{/if}
</div>
