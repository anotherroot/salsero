<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { sectionName, type Placed } from '$lib/songs/sections';

	/*
	 * "Sections · tap to jump": a plain list, the one playing and the next one
	 * marked. A tap seeks there and plays. No colours: one ink.
	 */
	let {
		sections,
		current,
		onjump
	}: {
		sections: Placed[];
		/** Index into `sections` of the one playing; -1 before the first. */
		current: number;
		onjump: (t: number) => void;
	} = $props();
</script>

{#if sections.length > 0}
	<h2 class="{SECTION_LABEL} pt-3.5">
		{t().songs.page.listen.sections} ·
		<span class="font-semibold">{t().songs.page.listen.tapToJump}</span>
	</h2>
	<ul class={GROUP}>
		{#each sections as s, i (s.index)}
			<li>
				<button
					type="button"
					class="focus-inset flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left"
					aria-label={t().songs.page.listen.jumpTo(sectionName(s), clock(s.t))}
					onclick={() => onjump(s.t)}
				>
					<span class="w-11 flex-none text-[15px] font-semibold text-muted tabular-nums"
						>{clock(s.t)}</span
					>
					<span
						class="min-w-0 flex-1 truncate text-[16px] leading-[1.3] {i === current
							? 'font-extrabold text-ink'
							: 'font-bold text-ink-2'}">{sectionName(s)}</span
					>
					{#if s.countOff}<Badge tone="neutral">{t().songs.page.listen.countOff}</Badge>{/if}
					{#if i === current}
						<Badge tone="accent">{t().songs.page.listen.playing}</Badge>
					{:else if i === current + 1}
						<span class="text-[13px] font-bold text-muted">{t().songs.page.listen.next}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}
