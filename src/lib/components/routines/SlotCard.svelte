<script lang="ts">
	/**
	 * One slot: the handle, the swipe layers, and — tapped open — the note and
	 * the alternatives. The card's TOP ROW is the tap and long-press target;
	 * what an open card shows below it (the note field, the alternative cards)
	 * takes its own taps and must not collapse the card.
	 */
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import type { ResolvedPathname } from '$app/types';
	import Swipeable from './Swipeable.svelte';
	import { resettingFocus } from './act';
	import type { RowView, Swiped } from './types';

	interface Props {
		row: RowView;
		index: number;
		count: number;
		expanded: boolean;
		selecting: boolean;
		selected: boolean;
		lifted: boolean;
		swiped: Swiped;
		press: LongPress;
		onswipe: (key: string, side: Side) => void;
		ontap: () => void;
		ongrab: (e: PointerEvent) => void;
		onkeymove: (delta: -1 | 1) => void;
		ondelete: () => void;
		onopen: (href: ResolvedPathname) => void;
		onremoveAlt: (figureId: number, label: string) => void;
		onaddAlt: () => void;
		onnote: (note: string | null) => void;
	}

	let {
		row,
		index,
		count,
		expanded,
		selecting,
		selected,
		lifted,
		swiped,
		press,
		onswipe,
		ontap,
		ongrab,
		onkeymove,
		ondelete,
		onopen,
		onremoveAlt,
		onaddAlt,
		onnote
	}: Props = $props();

	const sideOf = (key: string): Side => (swiped?.key === key ? swiped.side : null);
	const slotKey = $derived(`slot:${row.id}`);
</script>

<Swipeable
	key={slotKey}
	open={sideOf(slotKey)}
	onchange={(side) => onswipe(slotKey, side)}
	disabled={selecting}
	end={{ label: 'Delete', onclick: ondelete }}
	start={row.href ? { label: 'Open', onclick: () => onopen(row.href!) } : undefined}
>
	<div
		class="rounded-xl border bg-raised transition-[box-shadow,scale] duration-150 motion-reduce:transition-none {selected ||
		expanded
			? 'border-accent'
			: 'border-line'} {lifted ? 'scale-[1.02] shadow-xl' : ''}"
	>
		<div class="flex items-start gap-1 py-2 pr-2">
			{#if selecting}
				<span class="grid size-11 shrink-0 place-items-center" aria-hidden="true">
					<span
						class="grid size-6 place-items-center rounded-full border text-[13px] {selected
							? 'border-accent bg-accent text-accent-ink'
							: 'border-rule'}">{selected ? '✓' : ''}</span
					>
				</span>
			{:else}
				<button
					type="button"
					data-handle
					class="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-[18px] tracking-[-3px] text-rule"
					aria-label="Move slot {index + 1}. Arrow keys move it."
					onpointerdown={(e) => {
						// The handle is for dragging and nothing else: keep the swipe
						// and the long-press on the card from seeing this press.
						e.stopPropagation();
						e.preventDefault();
						ongrab(e);
					}}
					onkeydown={(e) => {
						if (e.key === 'ArrowUp' && index > 0) {
							e.preventDefault();
							onkeymove(-1);
						} else if (e.key === 'ArrowDown' && index < count - 1) {
							e.preventDefault();
							onkeymove(1);
						}
					}}>⋮⋮</button
				>
			{/if}

			<div
				role="button"
				tabindex="0"
				aria-expanded={selecting ? undefined : expanded}
				aria-pressed={selecting ? selected : undefined}
				class="min-w-0 flex-1 cursor-pointer py-1 select-none [-webkit-touch-callout:none]"
				onpointerdown={(e) => press.down(row.id, e.clientX, e.clientY)}
				onpointermove={(e) => press.move(e.clientX, e.clientY)}
				onpointerup={() => press.up()}
				onpointercancel={() => press.up()}
				oncontextmenu={(e) => e.preventDefault()}
				onclick={() => {
					if (press.swallow()) return;
					ontap();
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						ontap();
					}
				}}
			>
				<div class="flex items-center gap-2">
					<span
						class="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent"
						>{index + 1}</span
					>
					<span class="min-w-0 flex-1 truncate text-[15px] font-medium"
						>{#if row.isRoutine}<span class="text-muted">↻ </span>{/if}{row.title}</span
					>
				</div>
				{#if row.meta}
					<p class="mt-0.5 truncate pl-8 text-[12px] text-muted">{row.meta}</p>
				{/if}
				{#if !expanded}
					{#if row.note}
						<p class="mt-0.5 truncate pl-8 text-[12.5px] text-ink-2 italic">{row.note}</p>
					{/if}
					{#if row.alternatives.length > 0}
						<p class="truncate pl-8 text-[12px] text-muted">
							/ {row.alternatives.map((a) => a.label).join(' / ')}
						</p>
					{/if}
				{/if}
			</div>

			{#if expanded && row.href}
				<a href={row.href} class="h-9 shrink-0 px-2 text-[13px] leading-9 font-medium text-accent"
					>Open →</a
				>
			{/if}
		</div>

		{#if expanded}
			<!-- The note lives in the card, where a collapsed card shows it. Saved on
			     blur and Enter; Escape puts back what was there. Pointer events stop
			     here so selecting text never starts a swipe. -->
			<div
				role="presentation"
				class="pr-3 pb-3 pl-[3.25rem]"
				onpointerdown={(e) => e.stopPropagation()}
			>
				<input
					value={row.note ?? ''}
					maxlength="200"
					placeholder="✎ Add a note…"
					aria-label="Note for slot {index + 1}"
					class="w-full border-0 border-b border-dashed border-rule bg-transparent px-0 py-1 text-[13px] outline-none focus:border-accent"
					onkeydown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
						if (e.key === 'Escape') {
							e.currentTarget.value = row.note ?? '';
							e.currentTarget.blur();
						}
					}}
					onblur={(e) => {
						// SvelteKit borrowing the focus after another action; `act` hands it back.
						if (resettingFocus()) return;
						const v = e.currentTarget.value.trim();
						if (v !== (row.note ?? '')) onnote(v === '' ? null : v);
					}}
				/>
			</div>
		{/if}
	</div>
</Swipeable>

{#if expanded && !row.isRoutine}
	<div class="mt-1.5 ml-7 space-y-1.5 border-l-2 border-accent/25 pl-3">
		{#each row.alternatives as alt (alt.id)}
			{@const key = `alt:${row.id}:${alt.id}`}
			<Swipeable
				{key}
				rounded="rounded-lg"
				open={sideOf(key)}
				onchange={(side) => onswipe(key, side)}
				end={{ label: 'Remove', onclick: () => onremoveAlt(alt.id, alt.label) }}
				start={{ label: 'Open', onclick: () => onopen(alt.href) }}
			>
				<div
					class="flex items-center justify-between gap-3 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-[14px]"
				>
					<span class="min-w-0 truncate">{alt.label}</span>
					<span class="shrink-0 text-[11.5px] text-muted">{alt.timing}</span>
				</div>
			</Swipeable>
		{/each}
		{#if row.canAddAlternative}
			<button
				type="button"
				class="h-9 w-full rounded-lg border-[1.5px] border-dashed border-accent/40 text-[13px] font-medium text-accent"
				onclick={onaddAlt}>+ Alternative</button
			>
		{/if}
	</div>
{/if}

{#if row.failure}
	<p class="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
		{row.failure}
	</p>
{/if}
