<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { NOTICE_TITLE, SYNC, noticeLine } from '$lib/clones/step-view';
	import type { StepView } from '$lib/types';

	/**
	 * The notice under the version row (spec 2026-11-07, 2A): one warn-soft
	 * card when the person's copies disagree, "Your copies don't agree" with
	 * one Sync, then a line per copy that is off. Nothing when they agree, or
	 * when there is no Sync to open (`onsync` missing).
	 */
	let {
		step,
		pageMine,
		onsync
	}: {
		step: StepView;
		/** The page's row is the person's own: the lines say "yours", else "this one". */
		pageMine: boolean;
		onsync?: () => void;
	} = $props();
</script>

{#if step.lines.length > 0 && onsync}
	<section
		class="flex flex-col gap-1.5 rounded-2xl bg-warn-soft py-2 pr-2 pl-4"
		aria-label={NOTICE_TITLE}
	>
		<div class="flex items-center gap-2.5">
			<span class="flex-none text-warn"><Icon name="refresh" size={20} /></span>
			<h2 class="min-w-0 flex-1 text-[15px] leading-snug font-extrabold text-ink">
				{NOTICE_TITLE}
			</h2>
			<button type="button" class={button('primary', 'sm')} aria-haspopup="dialog" onclick={onsync}
				>{SYNC}</button
			>
		</div>
		<ul class="flex flex-col gap-1.5 pr-2 pb-1.5">
			{#each step.lines as l (`${l.id}:${l.state}:${l.how ?? ''}`)}
				<li class="flex items-baseline gap-2.5 text-[14px] leading-snug text-ink-2">
					<span class="size-2 flex-none translate-y-[-1px] rounded-full bg-warn" aria-hidden="true"
					></span>
					<span class="min-w-0 flex-1">{noticeLine(l, pageMine)}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}
