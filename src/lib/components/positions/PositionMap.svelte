<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { button } from '$lib/components/ui/styles';
	import type { MapLayout } from '$lib/positions/map';
	import { edgeGeometry, edgeKey, litOf, TONE_VAR, type MapTone } from '$lib/positions/map-view';
	import { MAP, mapLitLine } from '$lib/positions/view';
	import {
		clampView,
		NO_ZOOM,
		panView,
		pinchView,
		wheelView,
		zoomTransform,
		type Pt,
		type Size,
		type View
	} from '$lib/video/zoom';

	/**
	 * The map of positions (`map.ts` lays it out, `map-view.ts` says what lights
	 * and how arrows bend). A tap on a position lights its figures in and out in
	 * its type's colour and fades the rest; a second tap opens it; Escape or a tap
	 * on empty space clears. Two fingers zoom (1×–4×, `video/zoom.ts`), one finger
	 * moves a zoomed map, a double tap on empty space goes back to 1×, Ctrl+wheel
	 * is a trackpad's pinch. Each position is a link: Tab reaches it, Enter is a tap.
	 *
	 * `selected` is bindable, so the page around it can show the pick (the
	 * Positions list lights its row); `initial`, when given, is the pick it
	 * arrives with (`?pick=`), read once.
	 */
	interface MapPosition {
		id: number;
		name: string;
		label: string;
		tone: MapTone;
		ariaLabel: string;
		/** "Twins: your Cerrada, Salsa Tuesdays’ Closed" when it stands for twins; its tooltip. */
		twinsLine: string | null;
	}

	interface Props {
		dance: string;
		layout: MapLayout;
		positions: MapPosition[];
		edges: { from: number; to: number; width: number; figures: number }[];
		label: string;
		/** The picked position: lit, its figures in and out lit, the rest faded. */
		selected?: number | null;
		/** The pick the map arrives with, read once. */
		initial?: number | null;
	}

	let {
		dance,
		layout,
		positions,
		edges,
		label,
		selected = $bindable(null),
		initial
	}: Props = $props();
	untrack(() => {
		if (initial !== undefined) selected = initial;
	});

	const TONES: MapTone[] = ['accent', 'done', 'warn', 'muted'];
	const DOUBLE_TAP_MS = 300;
	const TAP_SLOP_PX = 10;

	const byId = $derived(new Map(positions.map((p) => [p.id, p])));
	const nodeById = $derived(new Map(layout.nodes.map((n) => [n.id, n])));
	const lit = $derived(litOf(edges, selected));
	const tone = $derived<MapTone>(
		selected === null ? 'muted' : (byId.get(selected)?.tone ?? 'muted')
	);
	// The lit arrows are drawn last, over the faded ones.
	const arrows = $derived(
		edges
			.map((e) => {
				const a = nodeById.get(e.from)!;
				const b = nodeById.get(e.to)!;
				const key = edgeKey(e);
				// Until the pill arrows (Task 3): each pill as the circle of half its height.
				const ca = { x: a.x, y: a.y, r: a.h / 2 };
				const cb = e.from === e.to ? ca : { x: b.x, y: b.y, r: b.h / 2 };
				return { ...e, key, on: lit.edges.has(key), ...edgeGeometry(ca, cb, e.from === e.to) };
			})
			.sort((x, y) => Number(x.on) - Number(y.on))
	);
	const status = $derived(
		selected === null ? MAP.hint : mapLitLine(byId.get(selected)?.name ?? '')
	);

	const hrefOf = (id: number) =>
		resolve('/[dance]/(moves)/positions/[id]', { dance, id: String(id) });

	function choose(e: MouseEvent, id: number) {
		// A new tab or window opens the position as any link would.
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		// The second tap on a lit position follows the link.
		if (selected === id) return;
		e.preventDefault();
		selected = id;
	}

	/* ---------- zoom ---------- */

	let el: HTMLDivElement;
	let box = $state<Size>({ w: 0, h: 0 });
	let view = $state<View>(NO_ZOOM);

	$effect(() => {
		const ro = new ResizeObserver(([e]) => {
			box = { w: e.contentRect.width, h: e.contentRect.height };
			view = clampView(view, box, box);
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	/** A point relative to the box's centre. */
	function rel(e: { clientX: number; clientY: number }): Pt {
		const r = el.getBoundingClientRect();
		return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
	}

	// Fingers on the map: bookkeeping for the handlers, never shown, so not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pts = new Map<number, Pt>();
	let press: { at: Pt; last: Pt; moved: boolean } | null = null;
	let pinch: { start: View; from: [Pt, Pt] } | null = null;
	/** A drag or a pinch happened: the click that follows it is not a tap. */
	let dragged = false;
	let lastTap = 0;

	function two(): [Pt, Pt] {
		const [a, b] = [...pts.values()];
		return [a, b];
	}

	/** Held from the first move only: a capture at pointerdown would steal the click from the link. */
	function capture(e: PointerEvent) {
		try {
			el.setPointerCapture(e.pointerId);
		} catch {
			// A pointer the browser no longer tracks: moves still arrive while over the map.
		}
	}

	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const p = rel(e);
		pts.set(e.pointerId, p);
		if (pts.size === 1) {
			press = { at: p, last: p, moved: false };
			dragged = false;
		} else if (pts.size === 2) {
			press = null;
			pinch = { start: view, from: two() };
			dragged = true;
			capture(e);
		}
	}

	function move(e: PointerEvent) {
		if (!pts.has(e.pointerId)) return;
		const p = rel(e);
		pts.set(e.pointerId, p);
		if (pinch && pts.size >= 2) {
			view = pinchView(pinch.start, pinch.from, two(), box, box);
			return;
		}
		if (!press || pts.size !== 1) return;
		if (!press.moved && Math.hypot(p.x - press.at.x, p.y - press.at.y) > TAP_SLOP_PX) {
			press.moved = true;
			dragged = true;
			capture(e);
		}
		if (press.moved && view.scale > 1) {
			view = panView(view, p.x - press.last.x, p.y - press.last.y, box, box);
		}
		press.last = p;
	}

	function up(e: PointerEvent) {
		if (!pts.has(e.pointerId)) return;
		pts.delete(e.pointerId);
		if (pinch) {
			if (pts.size < 2) {
				pinch = null;
				const [rest] = [...pts.values()];
				press = rest ? { at: rest, last: rest, moved: true } : null;
			}
			return;
		}
		const p = press;
		press = null;
		if (e.type !== 'pointerup' || !p || p.moved) return;
		// A double tap on empty space goes back to the whole map.
		if ((e.target as Element | null)?.closest('a')) return;
		const t = performance.now();
		if (t - lastTap < DOUBLE_TAP_MS) {
			view = NO_ZOOM;
			lastTap = 0;
		} else lastTap = t;
	}

	// Ctrl+wheel is how a trackpad pinch arrives; it must be able to stop the page zooming.
	$effect(() => {
		const onwheel = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			e.preventDefault();
			view = wheelView(view, rel(e), e.deltaY, box, box);
		};
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	function clickCapture(e: MouseEvent) {
		// Enter on a focused position (detail 0) is never a drag's end.
		if (!dragged || e.detail === 0) return;
		// The click a drag or a pinch ends with: neither a tap on a position nor a clear.
		dragged = false;
		e.preventDefault();
		e.stopPropagation();
	}

	function clickSpace(e: MouseEvent) {
		if (!(e.target as Element | null)?.closest('a')) selected = null;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		// An open dialog (a sheet from the list beside the map) takes its own Escape first.
		if (e.key !== 'Escape' || selected === null || e.defaultPrevented) return;
		if (document.querySelector('dialog[open]')) return;
		selected = null;
	}}
/>

<div class="flex flex-col gap-2">
	<!-- Pointer and click handlers only route gestures; every position inside is a link, and Escape clears. -->
	<!--
		The desktop: no taller than leaves the tray in view under it in the window (the
		board's 500 at 900), never under 360; the square drawing then sits centred in it.
	-->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		bind:this={el}
		class="focus-inset relative overflow-hidden rounded-2xl bg-surface select-none desk:max-h-[max(360px,calc(100dvh-400px))]"
		style:aspect-ratio="{layout.width} / {layout.height}"
		style:touch-action={view.scale > 1 ? 'none' : 'pan-y'}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclickcapture={clickCapture}
		onclick={clickSpace}
	>
		<div class="h-full w-full origin-center" style:transform={zoomTransform(view)}>
			<svg
				viewBox="0 0 {layout.width} {layout.height}"
				class="block h-full w-full"
				role="group"
				aria-label={label}
			>
				<defs>
					{#each TONES as t (t)}
						<marker
							id="map-head-{t}"
							viewBox="0 0 10 10"
							refX="7"
							refY="5"
							markerUnits="userSpaceOnUse"
							markerWidth="10"
							markerHeight="10"
							orient="auto-start-reverse"
						>
							<path d="M1 1 L9 5 L1 9 z" style:fill={TONE_VAR[t]} />
						</marker>
					{/each}
				</defs>

				{#each arrows as a (a.key)}
					{@const t = a.on ? tone : 'muted'}
					<g
						aria-hidden="true"
						style:opacity={selected === null ? 0.55 : a.on ? 1 : 0.12}
						class="transition-opacity duration-150 motion-reduce:transition-none"
					>
						<path
							d={a.d}
							fill="none"
							stroke-width={a.width}
							stroke-linecap="round"
							marker-end="url(#map-head-{t})"
							style:stroke={TONE_VAR[t]}
						/>
						{#if a.figures > 1}
							<text
								x={a.labelX}
								y={a.labelY}
								text-anchor="middle"
								dominant-baseline="central"
								class="text-[11px] font-extrabold"
								stroke-width="4"
								paint-order="stroke"
								style:fill={TONE_VAR[t]}
								style:stroke="var(--color-surface)">{a.figures}</text
							>
						{/if}
					</g>
				{/each}

				{#each layout.nodes as n (n.id)}
					{@const p = byId.get(n.id)}
					{@const t = p?.tone ?? 'muted'}
					{@const on = selected === n.id}
					<a
						href={hrefOf(n.id)}
						aria-label={p?.ariaLabel}
						class="group cursor-pointer transition-opacity duration-150 focus-visible:outline-none motion-reduce:transition-none"
						style:opacity={selected !== null && !lit.nodes.has(n.id) ? 0.28 : 1}
						onclick={(e) => choose(e, n.id)}
					>
						{#if p?.twinsLine}
							<!-- Who a twinned node stands for: the pointer's tooltip. -->
							<title>{p.twinsLine}</title>
						{/if}
						<!-- An interim pill until the map's rewrite: its box and its first line. -->
						<rect
							x={n.x - n.w / 2}
							y={n.y - n.h / 2}
							width={n.w}
							height={n.h}
							rx={n.h / 2}
							fill-opacity={on ? 1 : 0.16}
							stroke-width="2"
							stroke-dasharray={n.mark === 'orphan' ? '4 4' : undefined}
							style:fill={TONE_VAR[t]}
							style:stroke={n.mark ? 'var(--color-danger)' : TONE_VAR[t]}
						/>
						<!-- The focus ring: the link's own outline would box the whole group. -->
						<rect
							x={n.x - n.w / 2 - 4}
							y={n.y - n.h / 2 - 4}
							width={n.w + 8}
							height={n.h + 8}
							rx={n.h / 2 + 4}
							fill="none"
							stroke-width="2.5"
							class="opacity-0 group-focus-visible:opacity-100"
							style:stroke="var(--color-accent)"
						/>
						<text
							x={n.x}
							y={n.y}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[13px] font-extrabold"
							style:fill="var(--color-ink)">{n.lines[0]}</text
						>
						{#if n.mark && n.markY !== null}
							<!-- The label's second line, which the layout keeps clear (`markBox`). -->
							<text
								x={n.x}
								y={n.markY}
								text-anchor="middle"
								dominant-baseline="central"
								class="text-[10.5px] font-extrabold tracking-[0.04em] uppercase"
								stroke-width="4"
								paint-order="stroke"
								style:fill="var(--color-danger)"
								style:stroke="var(--color-surface)">{n.mark}</text
							>
						{/if}
						{#if n.twins && n.twinsY !== null}
							<!-- Twins are one node (ruling 16): the line after the name's and the
							     mark's, which the layout keeps clear (`twinsBox`). -->
							<text
								x={n.x}
								y={n.twinsY}
								text-anchor="middle"
								dominant-baseline="central"
								class="text-[10.5px] font-extrabold tracking-[0.04em] uppercase"
								stroke-width="4"
								paint-order="stroke"
								style:fill="var(--color-muted)"
								style:stroke="var(--color-surface)">{MAP.twins}</text
							>
						{/if}
					</a>
				{/each}
			</svg>
		</div>
	</div>

	<div class="flex min-h-9 items-center justify-between gap-2 px-1">
		<span role="status" class="text-[13px] text-muted">{status}</span>
		{#if view.scale > 1}
			<button type="button" class={button('tertiary', 'sm')} onclick={() => (view = NO_ZOOM)}>
				{MAP.reset}
			</button>
		{/if}
	</div>
</div>
