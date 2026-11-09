<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { GROUP, ROW_TALL, SECTION_LABEL } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The way to the AI's suggestions, at the top of You (the phone's Groups tab
	 * and the You page), under its own AI label unless `heading` is off: while
	 * something waits, or while an AI app is connected.
	 */
	let { dance, heading = true }: { dance: string; heading?: boolean } = $props();
	const waiting = $derived(Number(page.data.aiPending ?? 0));
	const shown = $derived(waiting > 0 || page.data.aiConnected === true);
	const w = $derived(t().suggestions);
</script>

{#if shown}
	{#if heading}<h2 class={SECTION_LABEL}>{w.section}</h2>{/if}
	<div class="{GROUP} mb-1">
		<a href="/{dance}/suggestions" class={ROW_TALL}>
			<LeadTile icon="list" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[16px] font-bold text-ink">{w.youRow}</span>
				{#if waiting}<span class="text-[13px] font-bold text-accent-text">{w.waiting(waiting)}</span
					>{/if}
			</span>
			{#if waiting}
				<span class="rounded-full bg-accent px-2 py-0.5 text-[13px] font-extrabold text-on-accent"
					>{waiting}</span
				>
			{/if}
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</a>
	</div>
{/if}
