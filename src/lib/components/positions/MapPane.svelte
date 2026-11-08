<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PositionMap from './PositionMap.svelte';
	import MapTray from './MapTray.svelte';
	import MapInfoSheet from './MapInfoSheet.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { getMoves } from '$lib/components/moves/moves-context';
	import { bandButton, button } from '$lib/components/ui/styles';
	import { desk } from '$lib/nav/desk.svelte';
	import type { MapData } from '$lib/positions/map-view';
	import type { Room } from '$lib/positions/map-fit';
	import { pick, steppedKey, type Trail } from '$lib/positions/map-sheet';
	import { pickOf } from '$lib/positions/pick';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The map, full screen (spec 2026-11-08-map-walk): the map route's page, and on
	 * the desktop the pane beside the Positions list with nothing open.
	 *
	 * The phone: the map fills the screen above the tab bar. The back button, the
	 * title and summary, and ⓘ float over its top, the whole-map ⤢ under ⓘ; the
	 * tray sits over its foot. The desktop: the pane's heading, then the map (at
	 * most 800 wide) and a 320 px panel beside it holding the tray.
	 *
	 * The state is here: the trail of picks and steps (`map-sheet.ts`), shared with
	 * the (moves) layout's pick (`getMoves().pick`) so the list lights the picked
	 * position's row. It arrives as `?pick=<id>` (a position's Show on the map),
	 * read once; the layout clears it when the map leaves the pane. Escape, or a
	 * tap on empty space, drops the pick.
	 */
	let { map }: { map: MapData } = $props();

	const moves = getMoves();
	const dance = $derived(page.params.dance ?? '');
	const list = $derived(resolve('/[dance]/(moves)/positions', { dance }));
	const drawn = $derived(new Set(map.layout.nodes.map((n) => n.id)));

	// Read once, on arrival: picking on the map does not touch the URL.
	let trail = $state<Trail>(
		untrack(() => ({
			picked: pickOf(
				page.url.searchParams,
				map.layout.nodes.map((n) => n.id)
			),
			back: []
		}))
	);
	// A pick the map no longer draws (the data changed under it) is no pick.
	const picked = $derived(trail.picked !== null && drawn.has(trail.picked) ? trail.picked : null);
	const stepped = $derived(picked === null ? null : steppedKey(trail));
	$effect(() => {
		moves.pick.value = picked;
	});

	const onpick = (id: number) => (trail = pick(trail, id, map));
	const clear = () => (trail = { picked: null, back: [] });

	let info = $state(false);
	let mapView: { whole(): void } | undefined = $state();

	// The room the map fits into: the box, less what floats over its top and foot. On the
	// phone the top is under the ⤢ (WHOLE_H: the button and its gap), which sits under ⓘ
	// at the right edge, where a full-width map's pills would be.
	let w = $state(0);
	let h = $state(0);
	let headH = $state(0);
	let trayH = $state(0);
	const DESK_TOP = 64;
	const WHOLE_H = 10 + 44 + 6;
	const room = $derived<Room>(
		desk.current
			? { w, h, top: DESK_TOP, bottom: 12 }
			: { w, h, top: headH + WHOLE_H, bottom: trayH + 8 }
	);

	const SHADOW = 'shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_20px_rgb(0_0_0/0.12)]';
</script>

<svelte:window
	onkeydown={(e) => {
		// An open dialog (ⓘ, a sheet from the list beside the map) takes its own Escape first.
		if (e.key !== 'Escape' || picked === null || e.defaultPrevented) return;
		if (document.querySelector('dialog[open]')) return;
		clear();
	}}
/>

{#snippet infoButton()}
	<button
		type="button"
		class="pointer-events-auto {bandButton('float')}"
		aria-label={t().map.info}
		onclick={() => (info = true)}><Icon name="info" /></button
	>
{/snippet}

{#snippet wholeButton()}
	<button
		type="button"
		class="pointer-events-auto {bandButton('float')}"
		aria-label={t().map.whole}
		onclick={() => mapView?.whole()}><Icon name="fit" /></button
	>
{/snippet}

<!--
	The phone: one fixed box between the top and the tab bar, everything in it placed
	over the map. The desktop: the pane's column, as tall as the window under the band row.
-->
<div
	class="fixed inset-x-0 top-0 bottom-[var(--pin-bottom)] mx-auto max-w-[560px] overflow-hidden bg-ground desk:static desk:mx-0 desk:flex desk:h-[calc(100dvh-var(--band-row-h))] desk:max-w-none desk:flex-col desk:overflow-visible desk:bg-transparent"
>
	<div class="hidden desk:block">
		<PaneHeading title={t().map.title} subtitle={map.summary} />
	</div>

	<!-- The phone's head: ‹, the title and summary, ⓘ. -->
	<div
		bind:offsetHeight={headH}
		class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2.5 px-3.5 pt-[calc(var(--safe-top)+14px)] desk:hidden"
	>
		<span class="pointer-events-auto contents"
			><BackButton tone="float" fallback={{ href: list, label: t().map.back }} /></span
		>
		<div
			class="pointer-events-auto flex min-w-0 flex-col rounded-[20px] bg-surface px-3.5 pt-[7px] pb-2 {SHADOW}"
		>
			<h1 class="font-display text-[20px] leading-[1.05] font-extrabold text-ink">
				{t().map.title}
			</h1>
			<p class="mt-0.5 text-[11.5px] leading-[1.3] font-semibold text-muted">{map.summary}</p>
		</div>
		<span class="flex-1"></span>
		{@render infoButton()}
	</div>
	{#if map.layout.nodes.length > 0}
		<div class="absolute right-3.5 z-10 desk:hidden" style:top="{headH + 10}px">
			{@render wholeButton()}
		</div>
	{/if}

	<div
		class="contents desk:flex desk:min-h-0 desk:flex-1 desk:gap-5 desk:px-10 desk:pt-4 desk:pb-10"
	>
		<div
			bind:clientWidth={w}
			bind:clientHeight={h}
			class="absolute inset-0 desk:relative desk:inset-auto desk:max-w-[800px] desk:min-w-0 desk:flex-1 desk:overflow-hidden desk:rounded-2xl desk:border desk:border-hairline desk:bg-ground"
		>
			{#if map.layout.nodes.length > 0}
				<PositionMap
					bind:this={mapView}
					layout={map.layout}
					positions={map.positions}
					edges={map.edges}
					label={map.mapLabel}
					{picked}
					{stepped}
					{room}
					{onpick}
					onspace={clear}
				/>
			{:else}
				<!-- Nothing to draw: the words keep the map's place, the tray stays under them. -->
				<div
					class="absolute inset-x-0 flex flex-col items-start gap-3 px-5"
					style:top="{room.top}px"
				>
					<p class="text-[14px] leading-[1.45] text-ink-2">
						{map.empty ? t().map.empty : t().map.unjoined}
					</p>
					{#if map.empty}
						<a class={button('secondary', 'sm')} href={list}>{t().map.back}</a>
					{/if}
				</div>
			{/if}
			<!-- The desktop's ⓘ and ⤢: over the map's top right (the title is the pane's heading). -->
			<div class="pointer-events-none absolute top-3 right-3 z-10 hidden gap-2 desk:flex">
				{@render infoButton()}
				{#if map.layout.nodes.length > 0}{@render wholeButton()}{/if}
			</div>
		</div>

		<!-- The tray: the phone's low sheet over the map's foot, the desktop's panel beside it. -->
		<div
			bind:offsetHeight={trayH}
			class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 rounded-t-[24px] bg-surface px-[18px] pt-2.5 pb-3.5 shadow-[0_-6px_24px_rgb(0_0_0/0.12)] desk:static desk:w-[320px] desk:flex-none desk:self-start desk:rounded-2xl desk:p-5 desk:shadow-none"
		>
			<div
				aria-hidden="true"
				class="h-[5px] w-10 self-center rounded-full bg-track desk:hidden"
			></div>
			<MapTray {map} {onpick} />
		</div>
	</div>
</div>

<MapInfoSheet
	open={info}
	onclose={() => (info = false)}
	types={map.types}
	inGroupMode={map.inGroupMode}
/>
