<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PositionMap from './PositionMap.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import { getMoves } from '$lib/components/moves/moves-context';
	import { button } from '$lib/components/ui/styles';
	import { TONE_VAR, type MapData } from '$lib/positions/map-view';
	import { pickOf } from '$lib/positions/pick';
	import { MAP, noPositionChip, unusedChip } from '$lib/positions/view';

	/**
	 * The map's body: the map, Not on the map, the islands and the legend. The map
	 * route's page (its Screen draws the title), and on the desktop the pane
	 * beside the Positions list with nothing open (`heading`: the pane's own title
	 * and summary, since that route has no Screen of its own). At most 800 px wide
	 * on the desktop.
	 *
	 * The pick is the (moves) layout's (`getMoves().pick`), so the list lights the
	 * picked position's row; it arrives as `?pick=<id>` (a position's Show on the
	 * map) and the layout clears it when the map leaves the pane.
	 */
	let { map, heading = false }: { map: MapData; heading?: boolean } = $props();

	const moves = getMoves();
	const dance = $derived(page.params.dance ?? '');
	const list = $derived(resolve('/[dance]/(moves)/positions', { dance }));
	const byId = $derived(new Map(map.positions.map((p) => [p.id, p])));
	const islands = $derived(map.layout.tray.islands.map((id) => byId.get(id)!));
	const unused = $derived(map.layout.tray.unused.map((id) => byId.get(id)!));
	const hrefOf = (id: number) =>
		resolve('/[dance]/(moves)/positions/[id]', { dance, id: String(id) });

	// Read once, on arrival: picking on the map does not touch the URL.
	const initial = untrack(() =>
		pickOf(
			page.url.searchParams,
			map.layout.nodes.map((n) => n.id)
		)
	);

	const TRAY_CHIP =
		'inline-flex min-h-9 items-center gap-2 rounded-full border-[1.6px] px-3.5 text-[13px] font-extrabold text-ink-2 active:bg-step';
	const TRAY_HEAD = 'text-[11px] font-extrabold tracking-[0.06em] uppercase';
</script>

<!-- Figures with no arrow, and positions with no figures: shown even before any position exists. -->
{#snippet notOnMap()}
	{#if map.noPosition > 0 || unused.length > 0}
		<section class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
			<h2 class="{TRAY_HEAD} text-muted">{MAP.notOnMap}</h2>
			<div class="flex flex-wrap gap-2">
				{#if map.noPosition > 0}
					<a
						class="{TRAY_CHIP} border-dashed border-field-line"
						href={resolve('/[dance]/(moves)/positions/none', { dance })}
						>{noPositionChip(map.noPosition)}</a
					>
				{/if}
				{#each unused as p (p.id)}
					<a class="{TRAY_CHIP} border-danger" href={hrefOf(p.id)}>{unusedChip(p.name)}</a>
				{/each}
			</div>
			{#if map.noPosition > 0}
				<p class="text-[12px] font-semibold text-muted">{MAP.fitsAnywhere}</p>
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet body()}
	<!-- The phone: the sheet's own rows, as ever. The desktop: one column, at most 800 wide. -->
	<div class="contents desk:flex desk:w-full desk:max-w-[800px] desk:flex-col desk:gap-2">
		{#if map.empty}
			<div class="flex flex-col items-start gap-3 px-1 pt-2">
				<p class="text-[14px] leading-[1.45] text-ink-2">{MAP.empty}</p>
				<a class={button('secondary', 'sm')} href={list}>{MAP.back}</a>
			</div>
			<div class="flex flex-col gap-3 pt-3 pb-4">
				{@render notOnMap()}
			</div>
		{:else}
			<div class="flex flex-col gap-3 pb-4">
				{#if map.layout.nodes.length > 0}
					<PositionMap
						{dance}
						layout={map.layout}
						positions={map.positions}
						edges={map.edges}
						label={map.mapLabel}
						bind:selected={moves.pick.value}
						{initial}
					/>
				{:else}
					<p class="px-1 text-[14px] leading-[1.45] text-ink-2">{MAP.unjoined}</p>
				{/if}

				{@render notOnMap()}

				{#if islands.length > 0}
					<section class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
						<h2 class="{TRAY_HEAD} text-muted">{MAP.islands}</h2>
						<div class="flex flex-wrap gap-2">
							{#each islands as p (p.id)}
								<a
									class="{TRAY_CHIP} border-field-line"
									href={hrefOf(p.id)}
									aria-label={p.ariaLabel}
								>
									<span
										aria-hidden="true"
										class="size-3 flex-none rounded-full"
										style:background="color-mix(in srgb, {TONE_VAR[p.tone]} 20%, transparent)"
										style:box-shadow="inset 0 0 0 2px {TONE_VAR[p.tone]}"
									></span>{p.label}
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<div class="flex flex-wrap gap-x-[18px] gap-y-2 px-1 text-[13px] font-semibold text-muted">
					{#each map.types as t (t.key)}
						<span class="inline-flex items-center gap-1.5">
							<span
								aria-hidden="true"
								class="size-3 rounded-full"
								style:background="color-mix(in srgb, {TONE_VAR[t.tone]} 20%, transparent)"
								style:box-shadow="inset 0 0 0 2px {TONE_VAR[t.tone]}"
							></span>{t.label}
						</span>
					{/each}
					{#if !map.inGroupMode}
						<span class="inline-flex items-center gap-1.5">
							<span aria-hidden="true" class="size-3.5 rounded-full border-2 border-danger"
							></span>{MAP.legend.deadEnd}
						</span>
						<span class="inline-flex items-center gap-1.5">
							<span
								aria-hidden="true"
								class="size-3.5 rounded-full border-2 border-dashed border-danger"
							></span>{MAP.legend.orphan}
						</span>
					{/if}
					<span class="inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							class="size-3.5 rounded-full border-2 border-dotted border-muted"
						></span>{MAP.legend.island}
					</span>
					<span>{MAP.legend.size}</span>
				</div>
			</div>
		{/if}
	</div>
{/snippet}

{#if heading}
	<PaneHeading title={MAP.title} subtitle={map.summary} />
	<div class="px-10 pt-[18px] pb-10">{@render body()}</div>
{:else}
	{@render body()}
{/if}
