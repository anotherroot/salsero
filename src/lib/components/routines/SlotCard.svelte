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
	import { t } from '$lib/i18n/catalog';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { END_ASK, END_CHIP, iconButton, LENGTH_CHIP } from '$lib/components/ui/styles';
	import { resettingFocus } from '$lib/act';
	import { track } from '$lib/unsaved/guard.svelte';
	import { openTools } from '$lib/routines/tools';
	import CardToolbar from './CardToolbar.svelte';
	import type { RowView, Swiped, ToolItem } from './types';

	interface Props {
		row: RowView;
		index: number;
		count: number;
		expanded: boolean;
		/** The face's corners: a card's own, or where it meets the corners of the piece lifting it. */
		rounded: string;
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
		/** Add a slot before / after this one: the open card's ↑ and ↓. */
		onaddBefore: () => void;
		onaddAfter: () => void;
		/** The length chip of an option whose length the routine sets: opens How long? (spec 2026-11-11). */
		onlength: (figureId: number, current: number) => void;
		/** The end chip or cell: opens Where does it end? (spec 2026-11-11, slot end). */
		onend: () => void;
		/** May return a promise (the save), which the unsaved-changes guard awaits. */
		onnote: (note: string | null) => unknown;
	}

	let {
		row,
		index,
		count,
		expanded,
		rounded,
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
		onaddBefore,
		onaddAfter,
		onlength,
		onend,
		onnote
	}: Props = $props();

	const sideOf = (key: string): Side => (swiped?.key === key ? swiped.side : null);
	const slotKey = $derived(`slot:${row.id}`);

	/** The open card's toolbar: length, + Alternative, Before n, After n (spec 2026-11-11, T3). */
	const tools: ToolItem[] = $derived(
		openTools(row).map((tool): ToolItem => {
			const n = index + 1;
			if (tool === 'length') {
				const length = row.length!;
				return {
					key: tool,
					label: t().routine.length.chip(length.n),
					name: t().routine.length.change(length.n),
					icon: 'clock',
					onclick: () => onlength(length.figureId, length.n)
				};
			}
			if (tool === 'end') {
				const chosen = row.end?.state === 'chosen' ? row.end.name : null;
				return {
					key: tool,
					label: chosen ?? t().routine.end.ask,
					name: chosen ? t().routine.end.change(chosen) : t().routine.end.choose,
					icon: 'ends-at',
					onclick: onend
				};
			}
			if (tool === 'before') {
				return {
					key: tool,
					label: t().routine.seam.before(n),
					name: t().routine.seam.addBefore(n),
					icon: 'arrow-up',
					onclick: onaddBefore
				};
			}
			return {
				key: tool,
				label: t().routine.seam.after(n),
				name: t().routine.seam.addAfter(n),
				icon: 'arrow-down',
				onclick: onaddAfter
			};
		})
	);

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
			label: t().routine.slot.noteUnsaved,
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
				return failed ? { ok: false, message: t().routine.slot.noteFailed } : { ok: true };
			}
		});
	});
</script>

<Swipeable
	key={slotKey}
	{rounded}
	reveal={100}
	open={sideOf(slotKey)}
	onchange={(side) => onswipe(slotKey, side)}
	disabled={selecting}
	end={{ label: t().common.delete, icon: 'trash', onclick: ondelete }}
>
	<!-- Dragged, the card is `raised`; its shadow, scale and tilt are on the `<li>`
	     (SlotList), outside the swipe layer's clip. Open or selected, the piece
	     around it (SlotList) lifts it; the face stays the surface. -->
	<div class="group/slot py-2 pr-1.5 pl-0.5 {rounded} {lifted ? 'bg-raised' : 'bg-surface'}">
		<!-- Handle and number centred against the whole card, however many lines it has. -->
		<div class="flex min-h-12 items-center gap-1.5">
			{#if selecting}
				<!-- The handle's room stays (inert), so no card changes width when selection starts. -->
				<span class="grid size-11 shrink-0 place-items-center text-muted/50" aria-hidden="true"
					><Icon name="drag" size={20} /></span
				>
			{:else}
				<button
					type="button"
					data-handle
					class="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:bg-step {lifted
						? 'bg-step'
						: ''}"
					aria-label={t().routine.slot.move(index + 1)}
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

			<!-- Selected: a check in the number's place; waiting to be tapped in: a dashed ring. -->
			<span
				class="grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold tabular-nums {selected ||
				(expanded && !selecting)
					? 'bg-accent text-on-accent'
					: selecting
						? 'border-2 border-dashed border-accent/40 text-accent-text'
						: 'bg-accent-soft text-accent-text'}"
				aria-hidden="true"
				>{#if selected}<Icon name="check" size={15} />{:else}{index + 1}{/if}</span
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
				{#if row.source}
					<p class="mt-1">
						<Badge tone="neutral"><Icon name="group" size={14} />{row.source}</Badge>
					</p>
				{/if}
				{#if row.meta}
					<p
						class="mt-0.5 flex min-w-0 items-center text-[13px] leading-[1.35] {selected
							? 'text-ink-2'
							: 'text-muted'}"
					>
						<span class="truncate">{row.meta}</span>
						{#if row.end && (row.end.name || (!selecting && !expanded))}
							{@const end = row.end}
							<!-- Spec 2026-11-11, slot end: a chosen end is a chip, an end still to
							     choose a dashed one, an end with nothing to choose its name alone.
							     Open or selecting, the chips give way to the name. -->
							{#if !row.meta.endsWith('→')}<span class="ml-1 flex-none" aria-hidden="true">·</span
								>{/if}
							{#if !selecting && !expanded && (end.state === 'chosen' || end.state === 'open')}
								<button
									type="button"
									class={end.state === 'chosen' ? END_CHIP : END_ASK}
									aria-label={end.state === 'chosen' && end.name
										? t().routine.end.change(end.name)
										: t().routine.end.choose}
									onpointerdown={(e) => e.stopPropagation()}
									onclick={(e) => {
										e.stopPropagation();
										onend();
									}}
									>{#if end.state === 'chosen' && end.name}<Icon name="ends-at" size={14} /><span
											class="max-w-36 truncate">{end.name}</span
										>{:else}{t().routine.end.ask}{/if}<Icon name="chevron-down" size={14} /></button
								>
							{:else if end.name}
								<span
									class="ml-1.5 inline-flex min-w-0 flex-none items-center gap-0.5 font-extrabold text-accent-text"
									><Icon name="ends-at" size={14} /><span class="max-w-36 truncate">{end.name}</span
									></span
								>
							{/if}
						{/if}
						{#if row.length && !selecting && !expanded}
							{@const length = row.length}
							<!-- Board C: the length on the closed slot; a tap opens How long?. -->
							<button
								type="button"
								class={LENGTH_CHIP}
								aria-label={t().routine.length.change(length.n)}
								onpointerdown={(e) => e.stopPropagation()}
								onclick={(e) => {
									e.stopPropagation();
									onlength(length.figureId, length.n);
								}}>{t().routine.length.chip(length.n)}<Icon name="chevron-down" size={14} /></button
							>
						{/if}
					</p>
				{/if}
				{#if !expanded}
					{#if row.note}
						<p class="mt-[3px] truncate text-[13px] leading-[1.35] text-ink-2 italic">
							{row.note}
						</p>
					{/if}
				{/if}
			</div>

			{#if expanded && row.href}
				<a
					href={row.href}
					class="flex h-11 shrink-0 items-center gap-0.5 pr-1.5 pl-2.5 text-[15px] font-extrabold text-accent-text"
					>{t().figure.practice.open}<Icon name="chevron-right" size={18} /></a
				>
			{/if}

			{#if !selecting && !lifted}
				<!-- The desktop's swipe-to-delete (desktop spec, "Pointer and hover"): on the
				     card's hover and on keyboard focus inside it. It is the swipe's Delete, so
				     the Undo toast and where focus goes after are the swipe's too. -->
				<!-- Zero wide until the card is hovered or has focus, not display:none, so Shift+Tab
				     from the next card still reaches it (and the card does not shift at rest). -->
				<span
					class="hidden shrink-0 desk:pointer-events-none desk:grid desk:w-0 desk:opacity-0 desk:group-focus-within/slot:pointer-events-auto desk:group-focus-within/slot:w-auto desk:group-focus-within/slot:opacity-100 desk:group-hover/slot:pointer-events-auto desk:group-hover/slot:w-auto desk:group-hover/slot:opacity-100"
				>
					<button
						type="button"
						class={iconButton('bare', 'danger')}
						aria-label={t().routine.slot.delete(index + 1)}
						title={t().common.delete}
						onclick={ondelete}><Icon name="trash" size={20} /></button
					>
				</span>
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
						placeholder={t().routine.slot.notePlaceholder}
						aria-label={t().routine.slot.noteLabel(index + 1)}
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

{#if expanded}
	<CardToolbar label={t().routine.slot.toolbar(index + 1)} items={tools} />
{/if}

{#if row.failure}
	<Banner kind="error" title={row.failure} />
{/if}
