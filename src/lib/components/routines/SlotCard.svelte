<script lang="ts">
	/**
	 * One slot: the handle, the swipe layers, and — tapped open — the note and
	 * the alternatives. The card's TOP ROW is the tap and long-press target;
	 * what an open card shows below it (the note field, the alternative cards)
	 * takes its own taps and must not collapse the card.
	 */
	import type { LongPress } from '$lib/longpress';
	import type { Side } from '$lib/gestures/swipe';
	import Swipeable from './Swipeable.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import { resettingFocus } from './act';
	import { track } from '$lib/unsaved/guard.svelte';
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
		onremoveAlt: (figureId: number, label: string) => void;
		onaddAlt: () => void;
		/** May return a promise (the save), which the unsaved-changes guard awaits. */
		onnote: (note: string | null) => unknown;
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
		onremoveAlt,
		onaddAlt,
		onnote
	}: Props = $props();

	const sideOf = (key: string): Side => (swiped?.key === key ? swiped.side : null);
	const slotKey = $derived(`slot:${row.id}`);

	/**
	 * The open note field, registered with the unsaved-changes guard while it
	 * exists: it saves on blur, but leaving by a back gesture or a sheet can
	 * skip the blur, and a half-typed note must then get the same Save / Stay /
	 * Leave question every other form gets.
	 */
	let noteInput: HTMLInputElement | undefined = $state();
	$effect(() => {
		const input = noteInput;
		if (!input) return;
		const typed = () => input.value.trim();
		return track({
			label: 'Slot note',
			node: input,
			dirty: () => typed() !== (row.note ?? ''),
			save: async () => {
				const v = typed();
				const result = await onnote(v === '' ? null : v);
				const failed =
					typeof result === 'object' &&
					result !== null &&
					'type' in result &&
					result.type !== 'success';
				return failed ? { ok: false, message: 'The note did not save.' } : { ok: true };
			}
		});
	});
</script>

<Swipeable
	key={slotKey}
	rounded="rounded-2xl"
	reveal={100}
	open={sideOf(slotKey)}
	onchange={(side) => onswipe(slotKey, side)}
	disabled={selecting}
	end={{ label: 'Delete', icon: 'trash', onclick: ondelete }}
>
	<!-- Lifted, the card is `raised`; its shadow, scale and tilt are on the `<li>`
	     (SlotList), outside the swipe layer's clip. -->
	<div
		class="rounded-2xl py-2 pr-1.5 pl-0.5 {selected
			? 'bg-accent-soft'
			: lifted
				? 'bg-raised'
				: 'bg-surface'} {!lifted && !selected && expanded
			? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
			: ''}"
	>
		<!-- Handle and number centred against the whole card, however many lines it has. -->
		<div class="flex min-h-12 items-center gap-1.5">
			{#if selecting}
				<span
					class="grid size-11 shrink-0 place-items-center [--icon-knockout:var(--color-on-accent)]"
					aria-hidden="true"
				>
					{#if selected}
						<span class="text-accent"><Icon name="check-circle" size={24} filled /></span>
					{:else}
						<span class="size-6 rounded-full border-2 border-muted"></span>
					{/if}
				</span>
			{:else}
				<button
					type="button"
					data-handle
					class="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:bg-step {lifted
						? 'bg-step'
						: ''}"
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
					}}><Icon name="drag" size={20} /></button
				>
			{/if}

			<span
				class="grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold tabular-nums {selected
					? 'bg-accent text-on-accent'
					: 'bg-accent-soft text-accent-text'}"
				aria-hidden="true">{index + 1}</span
			>

			<div
				role="button"
				tabindex="0"
				data-focus="slot-{row.id}"
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
				<p
					class="truncate text-[16px] leading-[1.3] font-bold {row.empty
						? selected
							? 'text-ink-2'
							: 'text-muted'
						: 'text-ink'}"
				>
					{#if row.isRoutine}<span class="mr-1.5 inline-block align-[-3px] text-accent-text"
							><Icon name="route" size={18} /></span
						>{/if}{row.title}
				</p>
				{#if row.meta}
					<p
						class="mt-0.5 truncate text-[13px] leading-[1.35] {selected
							? 'text-ink-2'
							: 'text-muted'}"
					>
						{row.meta}
					</p>
				{/if}
				{#if !expanded}
					{#if row.note}
						<p class="mt-[3px] truncate text-[13px] leading-[1.35] text-ink-2 italic">
							{row.note}
						</p>
					{/if}
					{#if row.alternatives.length > 0}
						<p
							class="mt-0.5 truncate text-[13px] leading-[1.35] {selected
								? 'text-ink-2'
								: 'text-muted'}"
						>
							<b class="font-bold">or</b>
							{row.alternatives.map((a) => a.label).join(', ')}
						</p>
					{/if}
				{/if}
			</div>

			{#if expanded && row.href}
				<a
					href={row.href}
					class="flex h-11 shrink-0 items-center gap-0.5 pr-1.5 pl-2.5 text-[15px] font-extrabold text-accent-text"
					>Open<Icon name="chevron-right" size={18} /></a
				>
			{/if}
		</div>

		{#if expanded}
			<!-- The note lives in the card, where a collapsed card shows it. Saved on
			     blur and Enter; Escape puts back what was there. Pointer events stop
			     here so selecting text never starts a swipe. -->
			<div
				role="presentation"
				class="pt-0.5 pr-3.5 pb-1.5 pl-[78px]"
				onpointerdown={(e) => e.stopPropagation()}
			>
				<div
					class="group flex h-10 items-center gap-2 border-b-[1.5px] border-dashed border-field-line focus-within:border-b-2 focus-within:border-solid focus-within:border-accent"
				>
					<span class="flex-none text-muted group-focus-within:text-accent-text"
						><Icon name="edit" size={16} /></span
					>
					<input
						bind:this={noteInput}
						value={row.note ?? ''}
						maxlength="200"
						placeholder="Add a note…"
						aria-label="Note for slot {index + 1}"
						class="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-medium text-ink outline-none placeholder:text-muted focus-visible:shadow-none! focus-visible:outline-none!"
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
			</div>
		{/if}
	</div>
</Swipeable>

{#if expanded && !row.isRoutine && (row.alternatives.length > 0 || row.canAddAlternative)}
	<div
		role="group"
		aria-label="Alternatives for slot {index + 1}"
		class="ml-7 flex flex-col gap-2 border-l-2 border-accent/25 py-0.5 pl-3"
	>
		{#each row.alternatives as alt (alt.id)}
			{@const key = `alt:${row.id}:${alt.id}`}
			<!--
				The name, then Open and Remove as square buttons the tile's height and
				rounding. No timing: an alternative starts and lands exactly like the
				slot's main figure, so it would only repeat the line above. A swipe
				left still removes it too. `accent-soft` is opaque, so the red under a
				swiped tile does not show through.
			-->
			<div class="flex items-center gap-1.5">
				<div class="min-w-0 flex-1">
					<Swipeable
						{key}
						rounded="rounded-xl"
						reveal={88}
						open={sideOf(key)}
						onchange={(side) => onswipe(key, side)}
						end={{ label: 'Remove', onclick: () => onremoveAlt(alt.id, alt.label) }}
					>
						<p
							class="h-11 truncate rounded-xl bg-accent-soft px-3.5 text-[15px] leading-[44px] font-bold text-ink"
						>
							{alt.label}
						</p>
					</Swipeable>
				</div>
				<a
					href={alt.href}
					data-focus="alt-{row.id}-{alt.id}"
					class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"
					aria-label="Open {alt.label}"
					title="Open"><Icon name="external" size={18} /></a
				>
				<button
					type="button"
					class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-danger-soft text-danger"
					aria-label="Remove {alt.label}"
					title="Remove"
					onclick={() => onremoveAlt(alt.id, alt.label)}><Icon name="trash" size={18} /></button
				>
			</div>
		{/each}
		{#if row.canAddAlternative}
			<button
				type="button"
				class="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-accent/50 text-[15px] font-extrabold text-accent-text"
				onclick={onaddAlt}><Icon name="plus" size={18} />Alternative</button
			>
		{/if}
	</div>
{/if}

{#if row.failure}
	<Banner kind="error" title={row.failure} />
{/if}
