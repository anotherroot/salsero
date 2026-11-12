<script lang="ts">
	import { flipList } from '$lib/motion/flip.svelte';
	/**
	 * The slots, the seams between them, the + at either end — and the drag.
	 *
	 * A drag starts the moment the handle is pressed. It first lets the page
	 * collapse the open card (it would be wrong mid-drag; the seams stay, so
	 * nothing jumps and no warning blinks away),
	 * waits for that layout, and corrects for how far the grabbed card moved, so
	 * the card stays under the finger. Then it measures every card ONCE, and on
	 * each move asks `$lib/gestures/drag` where the card would land, how far
	 * each other card slides to make room, and where the dashed gap it leaves
	 * open is drawn.
	 */
	import { tick, untrack } from 'svelte';
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import { autoScroll, dropIndex, gapTop, shiftFor } from '$lib/gestures/drag';
	import { dragEdges } from '$lib/gestures/edges';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import SlotCard from './SlotCard.svelte';
	import Seam from './Seam.svelte';
	import type { SelectionShape } from '$lib/routines/selection';
	import { DIM_OPEN, DIM_SELECT, FADE, faceRound, LIFTED, pieceRound, RING } from './lift';
	import type { PickFrom, RowView, Swiped } from './types';
	import SectionPanel from './SectionPanel.svelte';
	import { panelHue } from '$lib/routines/panels';
	import type { ChildView } from '$lib/types';

	interface Props {
		rows: RowView[];
		expanded: number | null;
		selecting: boolean;
		selected: number[];
		/** How the selection lifts: each row's piece and the runs of neighbours. */
		shape: SelectionShape;
		swiped: Swiped;
		flash: number | null;
		press: LongPress;
		onswipe: (key: string, side: Side) => void;
		ontap: (id: number) => void;
		ondragstart: () => void;
		ondragend: () => void;
		onreorder: (id: number, to: number) => Promise<void>;
		ondelete: (id: number) => void;
		/** A slot option's length chip (spec 2026-11-11). */
		onlength: (id: number, figureId: number, current: number) => void;
		/** A slot's end chip or cell (spec 2026-11-11, slot end). */
		onend: (id: number) => void;
		onnote: (id: number, note: string | null) => unknown;
		/** Sections and routines opened in place (spec 2026-11-12): their views and which are open. */
		children: Record<number, ChildView>;
		opened: number[];
		ontoggle: (stepId: number) => void;
		onunpack: (stepId: number) => void;
		/** New cards that glow a moment (spec 2026-11-12, D1). */
		glow?: number[];
		onadd: (at: number, from: PickFrom | null) => void;
	}

	let {
		rows,
		expanded,
		selecting,
		selected,
		shape,
		swiped,
		flash,
		press,
		onswipe,
		ontap,
		ondragstart,
		ondragend,
		onreorder,
		ondelete,
		onlength,
		onend,
		onnote,
		children,
		opened,
		ontoggle,
		onunpack,
		glow = [],
		onadd
	}: Props = $props();

	/** The vertical gap between cards: the list's `gap-2`. */
	const GAP = 8;
	const items = $state<HTMLElement[]>([]);
	/** The view of a slot's section or routine while it is open in place (spec 2026-11-12). */
	const openChild = (row: RowView): ChildView | undefined => {
		const id = row.childId;
		return id !== null && opened.includes(row.id) ? children[id] : undefined;
	};
	let drag = $state<{ id: number; from: number; to: number; dy: number; step: number } | null>(
		null
	);
	/** Each live card's top (relative to the list) and height, measured at grab. */
	let measured = $state.raw<{ tops: number[]; heights: number[] }>({ tops: [], heights: [] });

	async function grab(e: PointerEvent, index: number) {
		// A right or middle press on the handle is not a drag.
		if (e.button !== 0) return;
		const id = rows[index].id;
		const before = items[index].getBoundingClientRect().top;
		ondragstart();
		await tick();

		let startY: number;
		let startScroll: number;
		let centers: number[];
		try {
			const box = items[index].getBoundingClientRect();
			startY = e.clientY + (box.top - before);
			startScroll = window.scrollY;
			// Only the LIVE rows: `items` is bound by index and never truncated, so
			// after a delete a trailing entry still points past `rows.length` — at a
			// stale element, or `null` — and would throw here, leaving `dragging`
			// stuck true because `ondragend` is below, unreached.
			const boxes = items.slice(0, rows.length).map((el) => el.getBoundingClientRect());
			centers = boxes.map((b) => b.top + b.height / 2 + window.scrollY);
			const listTop = list?.getBoundingClientRect().top ?? 0;
			measured = { tops: boxes.map((b) => b.top - listTop), heights: boxes.map((b) => b.height) };
			// Start offset by however far the layout change moved the card, so it is
			// drawn exactly where the finger picked it up.
			drag = { id, from: index, to: index, dy: before - box.top, step: box.height + GAP };
		} catch (err) {
			ondragend();
			throw err;
		}

		// The auto-scroll zones start where the list is actually visible: below
		// the fixed slim band (a pushed screen has no other header), or the
		// desktop's band row, down to the tab bar's top when it shows, else the
		// viewport's bottom (the selection bar never shows during a drag). On the
		// desktop both bars are `display: none`: all-zero rects, absent here.
		const { top, bottom } = dragEdges(
			document.querySelector('[data-slim-band]')?.getBoundingClientRect() ?? null,
			document.querySelector('[data-tab-bar]')?.getBoundingClientRect() ?? null,
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--band-row-h')) || 0,
			window.innerHeight
		);
		let y = e.clientY;
		let frame = 0;
		const update = () => {
			if (!drag) return;
			const dy = y - startY + (window.scrollY - startScroll);
			drag.dy = dy;
			drag.to = dropIndex(centers, centers[index] + dy, index);
		};
		const scroll = () => {
			const v = autoScroll(y, top, bottom);
			if (v !== 0) {
				window.scrollBy(0, v);
				update();
			}
			frame = requestAnimationFrame(scroll);
		};
		const onmove = (ev: PointerEvent) => {
			y = ev.clientY;
			update();
		};
		const finish = (commit: boolean) => {
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onmove);
			window.removeEventListener('pointerup', onup);
			window.removeEventListener('pointercancel', oncancel);
			window.removeEventListener('keydown', onkey);
			const done = drag;
			drag = null;
			ondragend();
			if (commit && done && done.to !== done.from) onreorder(done.id, done.to);
		};
		const onup = () => finish(true);
		const oncancel = () => finish(false);
		const onkey = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') finish(false);
		};
		window.addEventListener('pointermove', onmove);
		window.addEventListener('pointerup', onup);
		window.addEventListener('pointercancel', oncancel);
		window.addEventListener('keydown', onkey);
		frame = requestAnimationFrame(scroll);
	}

	function offsetOf(i: number, id: number): number {
		if (!drag) return 0;
		return drag.id === id ? drag.dy : shiftFor(i, drag.from, drag.to, drag.step);
	}

	let list = $state<HTMLElement>();
	// Slots fold and open as they come and go, and a dropped one glides into place (motion round 1).
	flipList({ container: () => list, keys: () => rows.map((r) => r.id) });

	/**
	 * ↑/↓ on a handle. The keyed `{#each}` may move the focused handle's node
	 * when the optimistic order is drawn, which drops its focus — so it is put
	 * back on the MOVED slot's handle, once for the guess and once for the
	 * server's answer, and the next arrow key still has somewhere to go. The
	 * second time only when the focus was dropped: by then the user may have
	 * tabbed on, and that is theirs to keep.
	 */
	async function keymove(id: number, to: number) {
		const done = onreorder(id, to);
		await tick();
		focusHandle(id);
		await done;
		await tick();
		if (document.activeElement === null || document.activeElement === document.body) {
			focusHandle(id);
		}
	}

	function focusHandle(id: number) {
		const handle = list?.querySelector<HTMLElement>(`[data-slot="${id}"] [data-handle]`);
		if (handle && document.activeElement !== handle) handle.focus();
	}

	// A just-inserted slot is scrolled to; the flash itself is CSS. Only `flash`
	// starts it: `rows` is read untracked, or every reload inside the flash's
	// 1.2 s would scroll back to it.
	$effect(() => {
		if (flash === null) return;
		const id = flash;
		untrack(() => {
			const i = rows.findIndex((r) => r.id === id);
			const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
			items[i]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
		});
	});

	/** The last slot's "Add a slot", and the routine's first when optimistic deletes emptied it. */
	const addEnd =
		'flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-accent/50 text-[15px] font-extrabold text-accent-text disabled:cursor-default disabled:border-field-line disabled:text-disabled-ink';
</script>

{#snippet seam(row: RowView, i: number)}
	{#if row.seam}
		{@const next = row.seam.next}
		<Seam
			label={row.seam.label}
			above={i + 1}
			below={next + 1}
			onafter={() => onadd(i + 1, { row: i, side: 'after' })}
			onbefore={() => onadd(next, { row: next, side: 'before' })}
			onbetween={row.seam.bridge
				? () => onadd(i + 1, { row: i, side: 'between', next })
				: undefined}
		/>
	{/if}
{/snippet}

{#if rows.length === 0}
	<button type="button" class={addEnd} data-focus="add-slot" onclick={() => onadd(0, null)}
		><Icon name="plus" size={20} />{t().routine.slots.addFigure}</button
	>
{:else}
	<div class="flex justify-center pb-2">
		<button
			type="button"
			class="group grid size-11 cursor-pointer place-items-center disabled:cursor-default"
			disabled={selecting}
			aria-label={t().routine.picker.before(1)}
			onclick={() => onadd(0, { row: 0, side: 'before' })}
		>
			<span
				class="grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-accent/50 text-accent-text group-disabled:border-field-line group-disabled:text-disabled-ink"
				><Icon name="plus" size={18} /></span
			>
		</button>
	</div>
	<ul
		class="relative isolate flex flex-col gap-2"
		bind:this={list}
		data-dragging={drag ? '' : undefined}
	>
		{#if drag}
			<!-- Where the lifted card will land. Absolute, so it takes no room of its
			     own: the cards around it slide to open the space it marks. -->
			<li
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 rounded-2xl border-2 border-dashed border-accent/45 bg-accent/5 transition-[top] duration-150 motion-reduce:transition-none"
				style="top: {gapTop(
					measured.tops,
					measured.heights,
					drag.from,
					drag.to
				)}px; height: {measured.heights[drag.from]}px"
			></li>
		{/if}
		{#each rows as row, i (row.id)}
			{@const lifted = drag?.id === row.id}
			{@const sel = selecting ? (shape.pieces[i] ?? null) : null}
			{@const piece = sel ?? (!selecting && !drag && expanded === row.id ? 'single' : null)}
			{@const run = sel ? shape.runs.find((r) => r.from <= i && i <= r.to) : undefined}
			{@const runEnd = run?.to === i}
			<!-- The only run's last slot carries the tip and the selection's toolbar. -->
			{@const foot = runEnd && shape.runs.length === 1}
			<!-- A seam between two selected neighbours is drawn inside their piece. -->
			<!-- J1 (spec 2026-11-12): the seam stays where it is, selected or not. -->
			{@const seamInside = false}
			<!-- The offset is the `translate` property, not `transform`: CSS applies
			     `translate` outside `scale`, so the lifted card's 1.03 does not
			     stretch its offset and pull it off the finger. Only while dragging:
			     a `translate` makes the row a stacking context, and a piece's shadow
			     must sit under every card of the list, not inside its own row. -->
			<li
				bind:this={items[i]}
				data-slot={row.id}
				data-flip={row.id}
				class="flex flex-col gap-2 rounded-2xl {openChild(row)
					? `panel hue-${panelHue(1, !openChild(row)!.isSection)}`
					: ''} {lifted
					? 'relative z-10 shadow-[0_18px_40px_rgb(0_0_0/0.22)] transition-[scale,rotate,box-shadow] duration-150 motion-safe:scale-[1.03] motion-safe:-rotate-[0.8deg] motion-reduce:transition-none'
					: ''} {drag && !lifted
					? 'transition-transform duration-150 motion-reduce:transition-none'
					: FADE} {(!selecting && expanded !== null && expanded !== row.id) ||
				(selecting && sel === null && selected.length > 0)
					? selecting
						? DIM_SELECT
						: DIM_OPEN
					: ''} {sel === 'mid' || sel === 'bottom' ? 'joined' : ''} {flash === row.id
					? 'flash'
					: ''} {glow.includes(row.id) ? 'glow' : ''}"
				style={drag ? `translate: 0 ${offsetOf(i, row.id)}px` : undefined}
			>
				<!-- Open or selected, the card lifts in a piece (spec 2026-11-11, T3, S6–S8);
				     neighbours join theirs. Else the wrapper is `contents`, so the card is
				     never drawn anew between the two. -->
				<div
					class={piece
						? `${LIFTED} ${pieceRound(piece)} ${piece === 'single' ? RING : ''} ${sel === 'mid' || sel === 'bottom' ? 'shadow-[inset_0_1px_0_var(--color-hairline)]' : ''}`
						: 'contents'}
				>
					<SlotCard
						{row}
						open={opened.includes(row.id)}
						onopen={() => ontoggle(row.id)}
						onunpack={() => onunpack(row.id)}
						index={i}
						count={rows.length}
						expanded={expanded === row.id}
						rounded={faceRound(piece, foot || (piece !== null && !selecting))}
						{selecting}
						selected={selected.includes(row.id)}
						{lifted}
						{swiped}
						{press}
						{onswipe}
						ontap={() => ontap(row.id)}
						ongrab={(e) => grab(e, i)}
						onkeymove={(delta) => keymove(row.id, i + delta)}
						ondelete={() => ondelete(row.id)}
						onaddBefore={() => onadd(i, { row: i, side: 'before' })}
						onaddAfter={() => onadd(i + 1, { row: i, side: 'after' })}
						onlength={(figureId, current) => onlength(row.id, figureId, current)}
						onend={() => onend(row.id)}
						onnote={(note) => onnote(row.id, note)}
					/>
					{#if seamInside}
						<div class="px-2 pb-2">{@render seam(row, i)}</div>
					{/if}
				</div>
				{#if openChild(row)}
					{@const view = openChild(row)!}
					<SectionPanel
						{view}
						depth={1}
						{children}
						{opened}
						{ontoggle}
						path={[
							{ name: view.name || t().routine.section.unnamed, hue: panelHue(1, !view.isSection) }
						]}
					/>
				{/if}
				{#if !seamInside}
					{@render seam(row, i)}
				{/if}
			</li>
		{/each}
	</ul>
	<div class="pt-2">
		<button
			type="button"
			class={addEnd}
			data-focus="add-slot"
			disabled={selecting}
			aria-label={t().routine.slots.addSlotAfter(rows.length)}
			onclick={() => onadd(rows.length, { row: rows.length - 1, side: 'after' })}
			><Icon name="plus" size={20} />{t().routine.slots.addSlot}</button
		>
	</div>
{/if}

<style>
	/* J1 (spec 2026-11-12): a selected neighbour fills the gap above it, so the run reads as one
	   piece with no card moving. */
	/* D1 (spec 2026-11-12): a new card glows with the accent, then fades. */
	.glow :global([role='button']) {
		animation: glow 2s ease-out;
	}
	@keyframes glow {
		0%,
		35% {
			background: color-mix(in srgb, var(--color-accent) 18%, var(--color-surface));
		}
		100% {
			background: var(--color-surface);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glow :global([role='button']) {
			animation: none;
		}
	}
	.joined {
		position: relative;
	}
	.joined::before {
		content: '';
		position: absolute;
		inset: -0.5rem 0 auto;
		height: 0.5rem;
		background: var(--color-surface);
	}
	/*
	 * A ring, not a background: the card face (`bg-surface`) is opaque and sits
	 * on top of the `<li>`, so a background flash here is invisible. A
	 * box-shadow draws OUTSIDE the box instead, around the card, where nothing
	 * covers it.
	 */
	.flash {
		animation: flash 1.2s ease-out;
	}

	@keyframes flash {
		from {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 55%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flash {
			animation: none;
		}
	}
</style>
