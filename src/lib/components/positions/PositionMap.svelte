<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { MapLayout } from '$lib/positions/map';
	import {
		arrowLook,
		edgeGeometry,
		edgeKey,
		litOf,
		TONE_VAR,
		type ArrowLook,
		type MapDataPosition
	} from '$lib/positions/map-view';
	import { walkPill, type WalkLook } from '$lib/positions/walk';
	import {
		clampMapView,
		fitView,
		panMapView,
		pansWhole,
		pinchMapView,
		viewTransform,
		wheelMapView,
		wholeView,
		type Room
	} from '$lib/positions/map-fit';
	import type { Pt, View } from '$lib/video/zoom';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The map of positions, drawn (spec 2026-11-08-map-walk). `map.ts` lays it out
	 * once, on the server; a tap changes only what is lit and the view.
	 *
	 * Each position is a pill and a link to its page: Tab reaches it, Enter is a
	 * tap. A tap calls `onpick` instead of following the link, unless the pill is
	 * already `picked`, when it opens. A tap on empty space calls `onspace`. The
	 * picked position lights its arrows out (accent) and in (easy) and fades the
	 * rest; `stepped`, the edge just stepped along, is drawn thick in easy.
	 *
	 * The view is this component's: it starts at the whole map in `room` (the
	 * box, less what floats over its top and foot), eases to the lit positions
	 * (`fitView`) when `picked` changes, and back to the whole map when nothing
	 * is. Two fingers zoom from the whole map's scale to 4×, one finger moves a
	 * zoomed map, a double tap on empty space shows the whole map, Ctrl+wheel is
	 * a trackpad's pinch (`map-fit.ts`). `whole()` is the head's ⤢.
	 *
	 * While walking (`walk`, from `walkLook`) the walk is drawn instead: walked
	 * arrows thick in accent with their step numbers (dashed when no figure runs
	 * there: `loose`), the next places' arrows dashed, the current pill filled,
	 * the visited ones bordered, the rest faded; the view follows the walk's `fit`.
	 * A pill tap then does nothing, except while the walk stands nowhere, when it
	 * calls `onpick` (where to carry on from).
	 */
	interface Props {
		layout: MapLayout;
		positions: MapDataPosition[];
		edges: { from: number; to: number; width: number; figures: number }[];
		label: string;
		picked: number | null;
		stepped: string | null;
		walk?: WalkLook | null;
		room: Room;
		onpick: (id: number) => void;
		onspace: () => void;
	}

	let {
		layout,
		positions,
		edges,
		label,
		picked,
		stepped,
		walk = null,
		room,
		onpick,
		onspace
	}: Props = $props();

	const uid = $props.id();
	const DOUBLE_TAP_MS = 300;
	const TAP_SLOP_PX = 10;

	/** How each arrow tone is drawn: its token, opacity, dashes and head. Stepped and walked are thick (4.5 px). */
	const PAINT: Record<
		ArrowLook['tone'],
		{ color: string; opacity: number; z: number; dash?: string }
	> = {
		out: { color: 'var(--color-accent)', opacity: 1, z: 2 },
		in: { color: 'var(--color-easy)', opacity: 0.85, z: 1 },
		stepped: { color: 'var(--color-easy)', opacity: 1, z: 3 },
		rest: { color: 'var(--color-ink-2)', opacity: 0.42, z: 0 },
		faded: { color: 'var(--color-ink-2)', opacity: 0.07, z: 0 },
		walked: { color: 'var(--color-accent)', opacity: 1, z: 4 },
		loose: { color: 'var(--color-accent)', opacity: 1, z: 4, dash: '7 6' },
		next: { color: 'var(--color-accent)', opacity: 0.8, z: 2, dash: '5 5' }
	};
	const HEADS: { id: ArrowLook['tone']; color: string; size: number }[] = [
		{ id: 'out', color: PAINT.out.color, size: 9 },
		{ id: 'in', color: PAINT.in.color, size: 9 },
		{ id: 'rest', color: PAINT.rest.color, size: 9 },
		{ id: 'stepped', color: PAINT.stepped.color, size: 13 },
		{ id: 'walked', color: PAINT.walked.color, size: 13 }
	];
	const HEAD_OF: Partial<Record<ArrowLook['tone'], ArrowLook['tone']>> = {
		faded: 'rest',
		loose: 'walked',
		next: 'out'
	};
	const headOf = (tone: ArrowLook['tone']) => HEAD_OF[tone] ?? tone;
	const THICK = new Set<ArrowLook['tone']>(['stepped', 'walked', 'loose']);
	const widthOf = (tone: ArrowLook['tone'], w: number) =>
		THICK.has(tone) ? 4.5 : tone === 'next' ? 2 : w;

	const dance = $derived(page.params.dance ?? '');
	const byId = $derived(new Map(positions.map((p) => [p.id, p])));
	const nodeById = $derived(new Map(layout.nodes.map((n) => [n.id, n])));
	const lit = $derived(litOf(edges, picked));
	const frame = $derived({ width: layout.width, height: layout.height });

	const FADED: ArrowLook = { tone: 'faded', badge: null, count: null };

	// The lit arrows are drawn last, over the faded ones. A walk's loose arrows (no
	// figure runs there) are its own, drawn when both ends are on the map.
	const arrows = $derived(
		[
			...edges.map((e) => ({
				key: edgeKey(e),
				e,
				w: e.width,
				look: walk ? (walk.arrows.get(edgeKey(e)) ?? FADED) : arrowLook(e, { picked, stepped })
			})),
			...(walk?.loose ?? []).map((l) => ({ key: `loose-${edgeKey(l)}`, e: l, w: 2, look: l.look }))
		]
			.flatMap(({ key, e, w, look }) => {
				const a = nodeById.get(e.from);
				const b = nodeById.get(e.to);
				if (!a || !b) return [];
				return [
					{
						key,
						look,
						paint: PAINT[look.tone],
						width: widthOf(look.tone, w),
						...edgeGeometry(a, b, e.from === e.to)
					}
				];
			})
			.sort((x, y) => x.paint.z - y.paint.z)
	);
	/** A badge's pill: wider for "2,5". */
	const badgeW = (s: string) => Math.max(20, s.length * 6.6 + 10);

	const hrefOf = (id: number) =>
		resolve('/[dance]/(moves)/positions/[id]', { dance, id: String(id) });

	function choose(e: MouseEvent, id: number) {
		// A new tab or window opens the position as any link would.
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		// While walking a pill only picks where to carry on from, and only while the walk stands nowhere.
		if (walk) {
			e.preventDefault();
			if (walk.current === null) onpick(id);
			return;
		}
		// The second tap on the picked position follows the link.
		if (picked === id) return;
		e.preventDefault();
		onpick(id);
	}

	/* ---------- the view ---------- */

	let el: HTMLDivElement;
	let view = $state<View>({ scale: 1, x: 0, y: 0 });
	/** Measured once: until then the map is not shown (the view needs the room). */
	let ready = $state(false);
	/** The view eases to its next fit; a gesture moves it at once. */
	let easing = $state(false);
	/** What the view follows: the lit positions, the whole map (⤢), or the person's own zoom. */
	let follow = $state<'pick' | 'whole' | null>('pick');
	let lastFocus: string | undefined;
	/** What the view fits: the walk's path and next places, else the lit positions. */
	const focus = $derived(new Set<number>(walk ? walk.fit : lit.nodes));
	/** A new walk step or a new pick fits again, even after a zoom by hand. */
	const focusKey = $derived(
		walk ? `w${walk.current}:${[...walk.fit].sort((a, b) => a - b).join(',')}` : `p${picked}`
	);

	const roomOk = (r: Room) => r.w > 0 && r.h > 0;

	// A new pick, a new room (a resize, the tray's height) or new data (the frame, the
	// pills): fit again, unless the person has zoomed by hand, when the view only
	// stays inside the new bounds.
	$effect(() => {
		const r = room;
		const k = focusKey;
		const f = frame;
		const nodes = layout.nodes;
		if (!roomOk(r)) return;
		untrack(() => {
			if (k !== lastFocus) {
				lastFocus = k;
				follow = 'pick';
			}
			easing = ready;
			if (follow === 'pick')
				view = fitView(
					nodes.filter((n) => focus.has(n.id)),
					f,
					r
				);
			else if (follow === 'whole') view = wholeView(f, r);
			else view = clampMapView(view, f, r);
			ready = true;
		});
	});

	/** The whole map (the head's ⤢, a double tap on empty space). */
	export function whole() {
		if (!roomOk(room)) return;
		follow = 'whole';
		easing = true;
		view = wholeView(frame, room);
	}

	/** Moved by hand: no easing, and the view no longer follows a fit. */
	function byHand(v: View) {
		easing = false;
		follow = null;
		view = v;
	}

	/** A point from the box's top left: the room's frame. */
	function rel(e: { clientX: number; clientY: number }): Pt {
		const r = el.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
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
			byHand(pinchMapView(pinch.start, pinch.from, two(), frame, room));
			return;
		}
		if (!press || pts.size !== 1) return;
		if (!press.moved && Math.hypot(p.x - press.at.x, p.y - press.at.y) > TAP_SLOP_PX) {
			press.moved = true;
			dragged = true;
			capture(e);
		}
		// Only a zoomed map moves: at the whole map's scale there is nothing to see past it,
		// unless the panel floats over part of it (`pansWhole`).
		if (press.moved && (pansWhole(room) || view.scale > wholeView(frame, room).scale * 1.001)) {
			byHand(panMapView(view, p.x - press.last.x, p.y - press.last.y, frame, room));
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
		// A double tap on empty space shows the whole map.
		if ((e.target as Element | null)?.closest('a')) return;
		const now = performance.now();
		if (now - lastTap < DOUBLE_TAP_MS) {
			whole();
			lastTap = 0;
		} else lastTap = now;
	}

	// Ctrl+wheel is how a trackpad pinch arrives; it must be able to stop the page zooming.
	$effect(() => {
		const onwheel = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			e.preventDefault();
			byHand(wheelMapView(view, rel(e), e.deltaY, frame, room));
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
		if (!(e.target as Element | null)?.closest('a')) onspace();
	}
</script>

<!-- Pointer and click handlers only route gestures; every position inside is a link, and Escape clears (MapPane). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	bind:this={el}
	class="absolute inset-0 touch-none overflow-clip select-none"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onclickcapture={clickCapture}
	onclick={clickSpace}
>
	<!-- The ground's dots: still while the map moves over them. -->
	<svg aria-hidden="true" class="pointer-events-none absolute inset-0 h-full w-full">
		<defs>
			<pattern id="{uid}-dots" width="22" height="22" patternUnits="userSpaceOnUse">
				<circle cx="11" cy="11" r="1.1" style:fill="var(--color-track)" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" style:fill="url(#{uid}-dots)" />
	</svg>

	<div
		class="absolute top-0 left-0 origin-top-left motion-reduce:transition-none"
		class:invisible={!ready}
		class:transition-transform={easing}
		class:duration-500={easing}
		class:ease-out={easing}
		style:width="{layout.width}px"
		style:height="{layout.height}px"
		style:transform={viewTransform(view)}
	>
		<svg
			viewBox="0 0 {layout.width} {layout.height}"
			width={layout.width}
			height={layout.height}
			class="block overflow-visible"
			role="group"
			aria-label={label}
		>
			<defs>
				{#each HEADS as h (h.id)}
					<marker
						id="{uid}-{h.id}"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerUnits="userSpaceOnUse"
						markerWidth={h.size}
						markerHeight={h.size}
						orient="auto-start-reverse"
					>
						<path d="M1 1.2 L9 5 L1 8.8 z" style:fill={h.color} />
					</marker>
				{/each}
			</defs>

			{#each arrows as a (a.key)}
				<g
					aria-hidden="true"
					style:opacity={a.paint.opacity}
					class="transition-opacity duration-150 motion-reduce:transition-none"
				>
					<path
						d={a.d}
						fill="none"
						stroke-width={a.width}
						stroke-linecap="round"
						stroke-dasharray={a.paint.dash}
						marker-end="url(#{uid}-{headOf(a.look.tone)})"
						style:stroke={a.paint.color}
					/>
					{#if a.look.count !== null}
						<text
							x={a.labelX}
							y={a.labelY}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[11px] font-extrabold"
							stroke-width="4"
							paint-order="stroke"
							style:fill={a.paint.color}
							style:stroke="var(--color-ground)">{a.look.count}</text
						>
					{/if}
				</g>
			{/each}

			{#each layout.nodes as n (n.id)}
				{@const p = byId.get(n.id)}
				{@const tone = TONE_VAR[p?.tone ?? 'muted']}
				{@const wp = walk ? walkPill(walk, n.id) : null}
				{@const on = wp ? wp.tone === 'current' : picked === n.id}
				{@const been = wp?.tone === 'visited'}
				{@const x0 = n.x - n.w / 2}
				{@const y0 = n.y - n.h / 2}
				{@const rx = Math.min(n.h / 2, 17)}
				<a
					href={hrefOf(n.id)}
					data-map-pos={n.id}
					aria-label={p?.ariaLabel}
					class="group cursor-pointer transition-opacity duration-150 focus-visible:shadow-none focus-visible:outline-none motion-reduce:transition-none"
					style:opacity={wp ? wp.opacity : picked !== null && !lit.nodes.has(n.id) ? 0.28 : 1}
					onclick={(e) => choose(e, n.id)}
				>
					{#if p?.twinsLine}
						<!-- Who a twinned node stands for: the pointer's tooltip. -->
						<title>{p.twinsLine}</title>
					{/if}
					<!-- The pill: surface, its type's border; a gap's border in danger (an orphan's dashed). -->
					<rect
						x={x0}
						y={y0}
						width={n.w}
						height={n.h}
						{rx}
						stroke-width={on || been ? 2.5 : 2}
						stroke-dasharray={n.mark === 'orphan' && !on && !been ? '5 4' : undefined}
						style:fill={on ? 'var(--color-accent)' : 'var(--color-surface)'}
						style:stroke={on || been
							? 'var(--color-accent)'
							: n.mark
								? 'var(--color-danger)'
								: tone}
					/>
					<!-- The focus ring: the link's own outline would box the whole group. -->
					<rect
						x={x0 - 4}
						y={y0 - 4}
						width={n.w + 8}
						height={n.h + 8}
						rx={rx + 4}
						fill="none"
						stroke-width="2.5"
						class="opacity-0 group-focus-visible:opacity-100"
						style:stroke="var(--color-accent)"
					/>
					<circle cx={x0 + 15} cy={n.y} r="4.5" style:fill={on ? 'var(--color-on-accent)' : tone} />
					{#each n.lines as line, i (i)}
						<text
							x={x0 + 27}
							y={n.y + (i - (n.lines.length - 1) / 2) * 16}
							dominant-baseline="central"
							class="text-[13px] font-extrabold"
							style:fill={on ? 'var(--color-on-accent)' : 'var(--color-ink)'}>{line}</text
						>
					{/each}
					{#if n.mark && n.markY !== null}
						<!-- The mark's own line under the pill, which the layout keeps clear (`markBox`). -->
						<text
							x={n.x}
							y={n.markY}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[10px] font-extrabold tracking-[0.05em] uppercase"
							stroke-width="4"
							stroke-linejoin="round"
							paint-order="stroke"
							style:fill="var(--color-danger)"
							style:stroke="var(--color-ground)"
							>{n.mark === 'dead end' ? t().map.mark.deadEnd : t().map.mark.orphan}</text
						>
					{/if}
					{#if n.twins && n.twinsY !== null}
						<!-- Twins are one node (ruling 16): the line after the name's and the mark's (`twinsBox`). -->
						<text
							x={n.x}
							y={n.twinsY}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[10.5px] font-extrabold tracking-[0.04em] uppercase"
							stroke-width="4"
							stroke-linejoin="round"
							paint-order="stroke"
							style:fill="var(--color-muted)"
							style:stroke="var(--color-ground)">{t().map.twins}</text
						>
					{/if}
				</a>
			{/each}

			<!-- The walk's step numbers on its arrows: over the pills, so a short arrow's still shows. -->
			{#each arrows as a (a.key)}
				{#if a.look.badge !== null}
					<!-- "1", or "2,5" when walked twice. Taps pass through to the pill under it. -->
					<g aria-hidden="true" class="pointer-events-none">
						<rect
							x={a.labelX - badgeW(a.look.badge) / 2}
							y={a.labelY - 10}
							width={badgeW(a.look.badge)}
							height="20"
							rx="10"
							stroke-width="2.5"
							style:fill="var(--color-accent)"
							style:stroke="var(--color-ground)"
						/>
						<text
							x={a.labelX}
							y={a.labelY + 0.5}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[11px] font-extrabold"
							style:fill="var(--color-on-accent)">{a.look.badge}</text
						>
					</g>
				{/if}
			{/each}
		</svg>
	</div>
</div>
