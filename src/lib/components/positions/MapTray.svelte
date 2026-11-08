<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { trayChips } from '$lib/positions/map-tray';
	import { TONE_VAR, type MapData } from '$lib/positions/map-view';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The map at rest, under it (spec 2026-11-08-map-walk, "At rest"): the hint and
	 * one chip per thing the map can't show (`trayChips`). Nothing gets to and dead
	 * ends pick their first position (`onpick`); unused opens its first; no
	 * position goes to No position; each island to itself. The phone draws it in
	 * the low sheet over the map's foot, the desktop in the panel beside the map
	 * (`MapPane`). The chips scroll sideways, so the tray keeps its height.
	 */
	let { map, onpick }: { map: MapData; onpick: (id: number) => void } = $props();

	const dance = $derived(page.params.dance ?? '');
	const chips = $derived(trayChips(map));
	const hrefOf = (id: number) =>
		resolve('/[dance]/(moves)/positions/[id]', { dance, id: String(id) });

	const CHIP =
		'inline-flex min-h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold whitespace-nowrap';
</script>

<div class="flex flex-col gap-2.5">
	{#if map.layout.nodes.length > 0}
		<p class="text-[12.5px] leading-[1.35] font-semibold text-ink-2">{t().map.hint}</p>
	{/if}
	{#if chips.length > 0}
		<!-- One row that scrolls sideways (the phone's tray keeps its height); wraps on the desktop's panel. -->
		<div
			class="-mx-[18px] flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-[18px] desk:mx-0 desk:flex-wrap desk:px-0"
		>
			{#each chips as c (c.kind === 'island' ? `island:${c.id}` : c.kind)}
				{#if c.kind === 'orphans' || c.kind === 'deadEnds'}
					<button
						type="button"
						class="{CHIP} bg-danger-soft text-danger active:brightness-95"
						onclick={() => onpick(c.pick)}
						>{c.kind === 'orphans'
							? t().map.chip.orphans(c.count)
							: t().map.chip.deadEnds(c.count)}</button
					>
				{:else if c.kind === 'unused'}
					<a class="{CHIP} bg-chip text-ink active:brightness-95" href={hrefOf(c.open)}
						>{t().map.chip.unused(c.count)}</a
					>
				{:else if c.kind === 'noPosition'}
					<a
						class="{CHIP} border-[1.5px] border-dashed border-field-line text-ink-2 active:bg-step"
						href={resolve('/[dance]/(moves)/positions/none', { dance })}
						>{t().map.chip.noPosition(c.count)}</a
					>
				{:else}
					<!-- An island: cut off from the rest, so not on the map; its page. -->
					<a
						class="{CHIP} border-[1.5px] border-dotted border-muted text-ink active:bg-step"
						href={hrefOf(c.id)}
					>
						<span
							aria-hidden="true"
							class="size-2.5 flex-none rounded-full"
							style:background={TONE_VAR[c.tone]}
						></span>{c.name}
					</a>
				{/if}
			{/each}
		</div>
	{/if}
</div>
