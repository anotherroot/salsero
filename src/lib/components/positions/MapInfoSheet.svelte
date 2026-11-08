<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { button } from '$lib/components/ui/styles';
	import { TONE_VAR, type MapTone } from '$lib/positions/map-view';
	import { t } from '$lib/i18n/catalog';

	/**
	 * How the map works, behind ⓘ (spec 2026-11-08-map-walk, "At rest"): the
	 * legend that used to sit under the map. The types as small pills, the dead
	 * end and orphan borders (not in group mode: the gap report is the person's
	 * own), the island, the arrows' colours and thickness, and the gestures.
	 */
	let {
		open,
		onclose,
		types,
		inGroupMode
	}: {
		open: boolean;
		onclose: () => void;
		types: { key: string; label: string; tone: MapTone }[];
		inGroupMode: boolean;
	} = $props();

	/** A small pill as the map draws one: surface, a border, a dot. */
	const PILL = 'inline-flex h-6 w-9 flex-none items-center rounded-full border-2 bg-surface pl-1.5';
	const ROW = 'flex items-center gap-3 text-[14px] leading-[1.35] text-ink-2';
</script>

<Sheet title={t().map.info} {open} {onclose}>
	<ul class="flex flex-col gap-3">
		{#each types as ty (ty.key)}
			<li class={ROW}>
				<span aria-hidden="true" class={PILL} style:border-color={TONE_VAR[ty.tone]}
					><span class="size-2 rounded-full" style:background={TONE_VAR[ty.tone]}></span></span
				>{ty.label}
			</li>
		{/each}
		{#if !inGroupMode}
			<li class={ROW}>
				<span aria-hidden="true" class="{PILL} border-danger"></span>{t().map.legend.deadEnd}
			</li>
			<li class={ROW}>
				<span aria-hidden="true" class="{PILL} border-dashed border-danger"></span>{t().map.legend
					.orphan}
			</li>
		{/if}
		<li class={ROW}>
			<span aria-hidden="true" class="{PILL} border-dotted border-muted"></span>{t().map.legend
				.island}
		</li>
		<li class={ROW}>
			<span aria-hidden="true" class="h-[3px] w-9 flex-none rounded-full bg-accent"></span>{t().map
				.legend.out}
		</li>
		<li class={ROW}>
			<span aria-hidden="true" class="h-[3px] w-9 flex-none rounded-full bg-easy"></span>{t().map
				.legend.in}
		</li>
	</ul>
	<p class="mt-4 text-[14px] leading-[1.45] text-ink-2">{t().map.legend.arrows}</p>
	<p class="mt-2 text-[14px] leading-[1.45] text-ink-2">{t().map.legend.gestures}</p>
	<p class="mt-2 text-[14px] leading-[1.45] text-muted">{t().map.fitsAnywhere}</p>

	{#snippet footer()}
		<button type="button" class={button('primary', 'md', true)} onclick={onclose}
			>{t().common.done}</button
		>
	{/snippet}
</Sheet>
