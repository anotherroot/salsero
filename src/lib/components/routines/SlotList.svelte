<script lang="ts">
	/**
	 * The slots, the seams between them, the + at either end — and the drag.
	 *
	 * A drag starts the moment the handle is pressed. It first lets the page
	 * collapse the open card and hide the seams (both would be wrong mid-drag),
	 * waits for that layout, and corrects for how far the grabbed card moved, so
	 * the card stays under the finger. Then it measures every card ONCE, and on
	 * each move asks `$lib/gestures/drag` where the card would land and how far
	 * each other card slides to make room.
	 */
	import { tick } from 'svelte';
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import { autoScroll, dropIndex, shiftFor } from '$lib/gestures/drag';
	import SlotCard from './SlotCard.svelte';
	import Seam from './Seam.svelte';
	import type { RowView, Swiped } from './types';
	import type { ResolvedPathname } from '$app/types';

	interface Props {
		rows: RowView[];
		expanded: number | null;
		selecting: boolean;
		selected: number[];
		swiped: Swiped;
		flash: number | null;
		press: LongPress;
		onswipe: (key: string, side: Side) => void;
		ontap: (id: number) => void;
		ondragstart: () => void;
		ondragend: () => void;
		onreorder: (id: number, to: number) => void;
		ondelete: (id: number) => void;
		onopen: (href: ResolvedPathname) => void;
		onremoveAlt: (id: number, figureId: number, label: string) => void;
		onaddAlt: (id: number) => void;
		onnote: (id: number, note: string | null) => void;
		onadd: (at: number, from: { row: number; side: 'after' | 'before' } | null) => void;
	}

	let {
		rows,
		expanded,
		selecting,
		selected,
		swiped,
		flash,
		press,
		onswipe,
		ontap,
		ondragstart,
		ondragend,
		onreorder,
		ondelete,
		onopen,
		onremoveAlt,
		onaddAlt,
		onnote,
		onadd
	}: Props = $props();

	/** The vertical gap between cards: `space-y-2`. */
	const GAP = 8;
	const items: HTMLElement[] = [];
	let drag = $state<{ id: number; from: number; to: number; dy: number; step: number } | null>(
		null
	);

	async function grab(e: PointerEvent, index: number) {
		const id = rows[index].id;
		const before = items[index].getBoundingClientRect().top;
		ondragstart();
		await tick();
		const box = items[index].getBoundingClientRect();
		const startY = e.clientY + (box.top - before);
		const startScroll = window.scrollY;
		const centers = items.map((el) => {
			const b = el.getBoundingClientRect();
			return b.top + b.height / 2 + window.scrollY;
		});
		// Start offset by however far the layout change moved the card, so it is
		// drawn exactly where the finger picked it up.
		drag = { id, from: index, to: index, dy: before - box.top, step: box.height + GAP };

		let y = e.clientY;
		let frame = 0;
		const update = () => {
			if (!drag) return;
			const dy = y - startY + (window.scrollY - startScroll);
			drag.dy = dy;
			drag.to = dropIndex(centers, centers[index] + dy, index);
		};
		const scroll = () => {
			const v = autoScroll(y, 0, window.innerHeight);
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

	// A just-inserted slot is scrolled to; the flash itself is CSS.
	$effect(() => {
		if (flash === null) return;
		const i = rows.findIndex((r) => r.id === flash);
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		items[i]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
	});

	const plus =
		'grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-rule text-[20px] text-muted disabled:opacity-30';
</script>

{#if rows.length === 0}
	<button
		type="button"
		class="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-rule text-[14px] text-muted"
		onclick={() => onadd(0, null)}
		>+ Add a figure — the first slot is where the routine starts</button
	>
{:else}
	<div class="flex justify-center pb-2">
		<button
			type="button"
			class={plus}
			disabled={selecting}
			aria-label="Add before slot 1"
			onclick={() => onadd(0, { row: 0, side: 'before' })}>+</button
		>
	</div>
	<ul class="space-y-2">
		{#each rows as row, i (row.id)}
			{@const lifted = drag?.id === row.id}
			<li
				bind:this={items[i]}
				data-slot={row.id}
				class="rounded-xl {lifted ? 'relative z-10' : ''} {drag && !lifted
					? 'transition-transform duration-150 motion-reduce:transition-none'
					: ''} {flash === row.id ? 'flash' : ''}"
				style="transform: translateY({offsetOf(i, row.id)}px)"
			>
				<SlotCard
					{row}
					index={i}
					count={rows.length}
					expanded={expanded === row.id}
					{selecting}
					selected={selected.includes(row.id)}
					{lifted}
					{swiped}
					{press}
					{onswipe}
					ontap={() => ontap(row.id)}
					ongrab={(e) => grab(e, i)}
					onkeymove={(delta) => onreorder(row.id, i + delta)}
					ondelete={() => ondelete(row.id)}
					{onopen}
					onremoveAlt={(figureId, label) => onremoveAlt(row.id, figureId, label)}
					onaddAlt={() => onaddAlt(row.id)}
					onnote={(note) => onnote(row.id, note)}
				/>
				{#if row.seam && !selecting}
					{@const next = row.seam.next}
					<Seam
						label={row.seam.label}
						above={i + 1}
						below={next + 1}
						onafter={() => onadd(i + 1, { row: i, side: 'after' })}
						onbefore={() => onadd(next, { row: next, side: 'before' })}
					/>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="flex justify-center pt-2">
		<button
			type="button"
			class={plus}
			disabled={selecting}
			aria-label="Add after slot {rows.length}"
			onclick={() => onadd(rows.length, { row: rows.length - 1, side: 'after' })}>+</button
		>
	</div>
{/if}

<style>
	.flash {
		animation: flash 1.2s ease-out;
	}

	@keyframes flash {
		from {
			background: color-mix(in srgb, var(--color-accent) 22%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flash {
			animation: none;
		}
	}
</style>
