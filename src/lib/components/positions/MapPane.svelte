<script lang="ts">
	import { withView } from '$lib/teams/group-view';
	import { tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PositionMap from './PositionMap.svelte';
	import MapTray from './MapTray.svelte';
	import MapPanel from './MapPanel.svelte';
	import MapSheet from './MapSheet.svelte';
	import MapInfoSheet from './MapInfoSheet.svelte';
	import WalkSheet from './WalkSheet.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { getMoves } from '$lib/components/moves/moves-context';
	import { bandButton, button } from '$lib/components/ui/styles';
	import { desk } from '$lib/nav/desk.svelte';
	import type { MapData } from '$lib/positions/map-view';
	import { deskAside, deskRight, type Room } from '$lib/positions/map-fit';
	import {
		pick,
		positionSheet,
		stepBack,
		steppedKey,
		typingIn,
		type Trail
	} from '$lib/positions/map-sheet';
	import { pickOf } from '$lib/positions/pick';
	import {
		addFigure,
		currentOf,
		figureCount,
		jumpTo,
		undo,
		walkLook,
		type Walk
	} from '$lib/positions/walk';
	import { leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { t } from '$lib/i18n/catalog';
	// The page's group view (`?in=`, or its row's): links to the lists keep it.
	const viewTeam = $derived(page.data.groupMode?.teamId ?? null);

	/**
	 * The map, full screen (spec 2026-11-08-map-walk): the map route's page, and on
	 * the desktop the pane beside the Positions list with nothing open.
	 *
	 * The phone: the map fills the screen above the tab bar. The back button, the
	 * title and summary, and ⓘ float over its top, the whole-map ⤢ under ⓘ; the
	 * tray sits over its foot. The desktop: the pane's heading, then the map (the
	 * pane's width, at most 800), ⓘ and ⤢ over its top left, and a 320 px panel
	 * floating over its right holding the tray or a position (the map fits beside it,
	 * `room.right`, while 360 px of map stay there; a narrower pane keeps the map's
	 * size under the panel: `deskRight`).
	 *
	 * The state is here: the trail of picks and steps (`map-sheet.ts`), shared with
	 * the (moves) layout's pick (`getMoves().pick`) so the list lights the picked
	 * position's row. It arrives as `?pick=<id>` (a position's Show on the map),
	 * read once; the layout clears it when the map leaves the pane. A picked position
	 * has its sheet up (`MapSheet`, in `MapPanel`), which holds one history entry: Back,
	 * Escape or a tap on empty space drops the pick, back to the tray.
	 *
	 * Walk from here turns the sheet into the walk (`WalkSheet`, the model in
	 * `walk.ts`), drawn on the map by `walkLook`. Clear ends it on the position it
	 * stands at (the start's, when it stands nowhere). Back and Escape end it to the
	 * tray, asking first through Unsaved changes while it has figures; a tap on
	 * empty space does nothing while walking.
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

	let walk = $state<Walk | null>(null);
	const look = $derived(walk ? walkLook(walk, map.edges) : null);
	/** The walk's sheet, the scope Back asks about. */
	let walkNode = $state<HTMLElement | null>(null);

	$effect(() => {
		// The list lights where the walk stands (its start while it stands nowhere).
		moves.pick.value = walk ? (currentOf(walk) ?? walk.start) : picked;
	});

	const sheet = $derived(picked === null ? null : positionSheet(map, picked));
	/** The ‹ pill: where the last step came from. */
	const prev = $derived.by(() => {
		const id = picked === null ? undefined : trail.back.at(-1);
		const p = id === undefined ? undefined : map.positions.find((q) => q.id === id);
		return p ? { id: p.id, name: p.name } : null;
	});

	// A pill, or a Step to row: a step when it is one of the picked position's places.
	const onpick = (id: number) => {
		// While walking the map only answers a tap while the walk stands nowhere.
		if (walk) walk = jumpTo(walk, id);
		else trail = pick(trail, id, map);
	};
	// A tray or From chip starts afresh: never a step, even to a lit neighbour.
	const pickFresh = (id: number) => (trail = { picked: id, back: [] });

	/**
	 * Back to the tray (Back, Escape, a tap on empty space). Focus that was in the
	 * sheet goes back to the map, onto the position the sheet was about.
	 */
	function close() {
		const was = picked;
		const inSheet = document.activeElement?.closest('[data-map-panel]') != null;
		walk = null;
		trail = { picked: null, back: [] };
		if (was === null || !inSheet) return;
		void tick().then(() =>
			document.querySelector<SVGAElement>(`[data-map-pos="${was}"]`)?.focus({ preventScroll: true })
		);
	}

	/** The walk ends where it stands: that position's sheet (the start's, when it stands nowhere). */
	function endWalk() {
		if (!walk) return;
		const at = currentOf(walk) ?? walk.start;
		walk = null;
		trail = { picked: at, back: [] };
	}

	/** Back or Escape from a walk with figures asks first; the walk's own sheet is the scope. */
	function leaveWalk(leave: () => void) {
		if (walk && figureCount(walk) > 0 && walkNode) leaveOrAsk(walkNode, leave, t().common.close);
		else leave();
	}

	let info = $state(false);
	let mapView: { whole(): void } | undefined = $state();

	// The room the map fits into: the box, less what floats over its top and foot. On the
	// phone the top is under the ⤢ (WHOLE_H: the button and its gap), which sits under ⓘ
	// at the right edge, where a full-width map's pills would be.
	let w = $state(0);
	let h = $state(0);
	let headH = $state(0);
	let panelH = $state(0);
	// On the desktop the 320 px panel floats over the map's right, 12 px in: the map
	// fits in what is left of it (`right`) while that is at least 360 px; a narrower
	// pane keeps the map's size under the panel, to be panned (`deskRight`).
	const DESK_TOP = 64;
	const WHOLE_H = 10 + 44 + 6;
	const room = $derived<Room>(
		desk.current
			? { w, h, top: DESK_TOP, bottom: 12, right: deskRight(w), aside: deskAside(w) }
			: { w, h, top: headH + WHOLE_H, bottom: panelH + 8 }
	);
	/**
	 * Where the words of an empty map start: beside the panel, or, when the panel
	 * floats over a narrow pane, under it.
	 */
	const wordsTop = $derived(
		desk.current && !room.right ? Math.max(room.top, panelH + 24) : room.top
	);

	const SHADOW = 'shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_20px_rgb(0_0_0/0.12)]';
</script>

<svelte:window
	onkeydown={(e) => {
		// An open dialog (ⓘ, a sheet from the list beside the map) takes its own Escape first.
		if (e.key !== 'Escape' || (picked === null && !walk) || e.defaultPrevented) return;
		if (document.querySelector('dialog[open]')) return;
		// A field's Escape is its own (a search, the routine's name).
		if (typingIn(e.target as HTMLElement | null)) return;
		leaveWalk(close);
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
	class="fixed inset-x-0 top-0 bottom-[var(--pin-bottom)] mx-auto max-w-[560px] overflow-clip bg-ground desk:static desk:mx-0 desk:flex desk:h-[calc(100dvh-var(--band-row-h))] desk:max-w-none desk:flex-col desk:overflow-visible desk:bg-transparent"
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
			><BackButton
				tone="float"
				fallback={{ href: withView(list, viewTeam), label: t().map.back }}
			/></span
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

	<div class="contents desk:flex desk:min-h-0 desk:flex-1 desk:px-10 desk:pt-4 desk:pb-10">
		<div
			bind:clientWidth={w}
			bind:clientHeight={h}
			class="absolute inset-0 desk:relative desk:inset-auto desk:max-w-[800px] desk:min-w-0 desk:flex-1 desk:overflow-clip desk:rounded-2xl desk:border desk:border-hairline desk:bg-ground"
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
					walk={look}
					{room}
					{onpick}
					onspace={() => {
						if (!walk) close();
					}}
				/>
			{:else}
				<!-- Nothing to draw: the words keep the map's place, the tray stays under them. -->
				<div
					class="absolute inset-x-0 flex flex-col items-start gap-3 px-5"
					style:top="{wordsTop}px"
					style:right="{room.right ?? 0}px"
				>
					<p class="text-[14px] leading-[1.45] text-ink-2">
						{map.empty ? t().map.empty : t().map.unjoined}
					</p>
					{#if map.empty}
						<a class={button('secondary', 'sm')} href={list}>{t().map.back}</a>
					{/if}
				</div>
			{/if}
			<!-- The desktop's ⓘ and ⤢: over the map's top left (the title is the pane's heading, the panel is on the right). -->
			<div class="pointer-events-none absolute top-3 left-3 z-10 hidden gap-2 desk:flex">
				{@render infoButton()}
				{#if map.layout.nodes.length > 0}{@render wholeButton()}{/if}
			</div>

			<!-- The tray, or the picked position's sheet: the phone's bottom sheet over the map's foot; on the desktop a panel floating over its right. -->
			<MapPanel
				mode={walk ? 'walk' : sheet ? 'position' : 'tray'}
				onclose={close}
				tryLeave={leaveWalk}
				bind:height={panelH}
			>
				{#if walk}
					<WalkSheet
						{map}
						{walk}
						bind:node={walkNode}
						onadd={(fig, to) => walk && (walk = addFigure(walk, fig, to))}
						onundo={() => walk && (walk = undo(walk))}
						onclear={endWalk}
						onsaved={endWalk}
						onmade={close}
					/>
				{:else if sheet}
					<MapSheet
						{sheet}
						{prev}
						onstep={onpick}
						onfresh={pickFresh}
						onback={() => (trail = stepBack(trail))}
						onwalk={() => (walk = { start: sheet.id, steps: [] })}
					/>
				{:else}
					<MapTray {map} onpick={pickFresh} />
				{/if}
			</MapPanel>
		</div>
	</div>
</div>

<MapInfoSheet
	open={info}
	onclose={() => (info = false)}
	types={map.types}
	inGroupMode={map.inGroupMode}
/>
