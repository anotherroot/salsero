<!-- src/lib/components/video/SpotEditor.svelte -->
<script lang="ts" module>
	/** How an edit was made: it decides what the player plays or shows afterwards. */
	export type MoveHow = 'second' | 'tenth' | 'now' | 'whole' | 'drag';
	export type Times = { startMs: number; endMs: number | null };
</script>

<script lang="ts">
	import {
		lengthText,
		moveEdge,
		preciseTime,
		resizeSpot,
		shiftSpot,
		spotLabel,
		spotTime,
		TENTH_MS,
		WHOLE_RESIZE_MS,
		WHOLE_SHIFT_MS
	} from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN, BTN_ACCENT, BTN_DANGER, BTN_GHOST, BTN_OUTLINE } from './styles';
	import Transport from './Transport.svelte';
	import TrimStrip from './TrimStrip.svelte';

	/**
	 * One spot's editor. Every button works out the spot's new times with the
	 * pure functions in `spots.ts` — a button whose function says "no change"
	 * is disabled — and hands them up; the player writes them and seeks so the
	 * change is seen or heard.
	 */
	interface Props {
		spot: Spot;
		/** The edge the move row acts on. A point only has a start. */
		selected: 'start' | 'end';
		currentMs: number;
		durationS: number;
		paused: boolean;
		/** The section's loop is running (the Loop toggle pauses it). */
		looping: boolean;
		/** The compact transport under the video (portrait); elsewhere it is the player's own. */
		transport?: boolean;
		/** The desktop card: the edge selectors show their keys. */
		keys?: boolean;
		onselect: (edge: 'start' | 'end') => void;
		onmove: (times: Times, how: MoveHow, edge: 'start' | 'end') => void;
		ondragstart: (edge: 'start' | 'end') => void;
		ondragend: (edge: 'start' | 'end') => void;
		onseek: (ms: number) => void;
		onloop: () => void;
		onrename: () => void;
		ondelete: () => void;
		/** Opens the Link popup; only a section on a page that may link gets one. */
		onlink?: () => void;
		ondone: () => void;
		ontoggle: () => void;
		ontenth: (d: -1 | 1) => void;
	}

	let {
		spot,
		selected,
		currentMs,
		durationS,
		paused,
		looping,
		transport = false,
		keys = false,
		onselect,
		onmove,
		ondragstart,
		ondragend,
		onseek,
		onloop,
		onrename,
		ondelete,
		onlink,
		ondone,
		ontoggle,
		ontenth
	}: Props = $props();

	const isSection = $derived(spot.endMs !== null);
	const edge = $derived<'start' | 'end'>(isSection ? selected : 'start');
	const atMs = $derived(edge === 'start' ? spot.startMs : (spot.endMs ?? spot.startMs));

	const steps = $derived([
		{ label: '−1 s', how: 'second', times: moveEdge(spot, edge, atMs - 1000, durationS) },
		{ label: '−0.1 s', how: 'tenth', times: moveEdge(spot, edge, atMs - TENTH_MS, durationS) },
		{ label: '+0.1 s', how: 'tenth', times: moveEdge(spot, edge, atMs + TENTH_MS, durationS) },
		{ label: '+1 s', how: 'second', times: moveEdge(spot, edge, atMs + 1000, durationS) }
	] as const);
	const now = $derived(moveEdge(spot, edge, Math.round(currentMs), durationS));
	const whole = $derived([
		{ label: '‹ Earlier', times: shiftSpot(spot, -WHOLE_SHIFT_MS, durationS) },
		{ label: 'Shorter', times: resizeSpot(spot, -WHOLE_RESIZE_MS, durationS) },
		{ label: 'Longer', times: resizeSpot(spot, WHOLE_RESIZE_MS, durationS) },
		{ label: 'Later ›', times: shiftSpot(spot, WHOLE_SHIFT_MS, durationS) }
	]);

	/** Under the name: the times when the name is a label, else just the length (the name is the times). */
	const sub = $derived(
		spot.endMs === null
			? `Point at ${preciseTime(spot.startMs)}`
			: spot.label
				? `${spotLabel({ ...spot, label: null })} · ${lengthText(spot.endMs - spot.startMs)}`
				: lengthText(spot.endMs - spot.startMs)
	);

	function onDrag(e: 'start' | 'end', ms: number) {
		// Hundredths: the precision the times are shown in.
		const snapped = Math.round(ms / 10) * 10;
		const times = moveEdge(spot, e, snapped, durationS);
		if (times) onmove(times, 'drag', e);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if transport}
		<div class="flex h-13 shrink-0 items-center gap-1 border-b border-(--pl-raised) pr-2 pl-4">
			<span class="text-[15px] font-semibold tabular-nums">{preciseTime(currentMs)}</span>
			<span class="flex-1"></span>
			<Transport {paused} size="compact" seconds={false} {ontoggle} onstep={() => {}} {ontenth} />
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-3.5 pb-1">
		<div class="flex items-start gap-2">
			<button
				type="button"
				class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left"
				aria-label="Rename {spotLabel(spot)}"
				onclick={onrename}
			>
				<span class="flex items-center gap-2 text-[19px] font-semibold">
					<span class="truncate">{spotLabel(spot)}</span>
					<Icon d={icons.pencil} size={16} class="text-(--pl-muted)" />
				</span>
				<span class="text-[13px] text-(--pl-muted) tabular-nums">{sub}</span>
			</button>
			{#if isSection}
				<button
					type="button"
					class="{looping ? BTN_ACCENT : BTN} h-9 rounded-full text-[13px]"
					aria-pressed={looping}
					onclick={onloop}
				>
					<Icon d={icons.loop} size={16} />{looping ? 'Looping' : 'Loop'}
				</button>
			{/if}
		</div>
		{#if onlink}
			<button
				type="button"
				class="-mt-1.5 flex cursor-pointer items-center gap-1.5 self-start text-left text-[13px] {spot
					.linkedTo.length > 0
					? 'text-(--pl-ink-2)'
					: 'font-semibold text-(--pl-accent)'}"
				onclick={onlink}
			>
				<Icon d={icons.link} size={14} />{spot.linkedTo.length > 0
					? `Linked to ${spot.linkedTo.join(', ')} ›`
					: '+ Link'}
			</button>
		{:else if spot.linkedTo.length > 0}
			<span class="-mt-1.5 flex items-center gap-1.5 text-[13px] text-(--pl-ink-2)">
				<Icon d={icons.link} size={14} />Linked to {spot.linkedTo.join(', ')}
			</span>
		{/if}

		<TrimStrip
			{spot}
			selected={edge}
			{currentMs}
			{durationS}
			{ondragstart}
			ondrag={onDrag}
			{ondragend}
			{onseek}
		/>

		{#if isSection}
			<div class="flex gap-2">
				{#each ['start', 'end'] as const as e (e)}
					{@const on = edge === e}
					<button
						type="button"
						class="flex h-14 flex-1 cursor-pointer flex-col items-start justify-center rounded-xl border-2 px-3.5 tabular-nums {on
							? 'border-(--pl-accent) bg-(--pl-raised)'
							: 'border-(--pl-surface) bg-(--pl-surface)'}"
						aria-pressed={on}
						onclick={() => onselect(e)}
					>
						<span class="flex items-center gap-1 text-[12px] text-(--pl-muted)">
							{#if e === 'start'}
								<Icon d={icons.startEdge} size={13} />Start
							{:else}
								End<Icon d={icons.endEdge} size={13} />
							{/if}
							{#if keys}<kbd class="kbd">{e === 'start' ? 'I' : 'O'}</kbd>{/if}
						</span>
						<span class="text-[17px] font-semibold"
							>{preciseTime(e === 'start' ? spot.startMs : (spot.endMs ?? 0))}</span
						>
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex flex-col gap-1.5">
			<span class="text-[12px] text-(--pl-muted)"
				>{isSection
					? edge === 'start'
						? 'Move the start'
						: 'Move the end'
					: 'Move the point'}</span
			>
			<div class="flex gap-1.5">
				{#each steps.slice(0, 2) as s (s.label)}
					<button
						type="button"
						class="{BTN} h-13 flex-1 px-1"
						disabled={!s.times}
						onclick={() => s.times && onmove(s.times, s.how, edge)}>{s.label}</button
					>
				{/each}
				<button
					type="button"
					class="{BTN} h-13 flex-[1.3] flex-col gap-0 px-1 leading-tight"
					disabled={!now}
					onclick={() => now && onmove(now, 'now', edge)}
				>
					<span>Now</span>
					<span class="text-[11px] text-(--pl-muted)">{spotTime(currentMs)}</span>
				</button>
				{#each steps.slice(2) as s (s.label)}
					<button
						type="button"
						class="{BTN} h-13 flex-1 px-1"
						disabled={!s.times}
						onclick={() => s.times && onmove(s.times, s.how, edge)}>{s.label}</button
					>
				{/each}
			</div>
		</div>

		{#if isSection && spot.endMs !== null}
			<div class="flex flex-col gap-1.5">
				<span class="text-[12px] text-(--pl-muted)"
					>Whole section · {lengthText(spot.endMs - spot.startMs)}</span
				>
				<div class="flex gap-1.5">
					{#each whole as w (w.label)}
						<button
							type="button"
							class="{BTN_OUTLINE} flex-1 px-1 text-[13px] whitespace-nowrap"
							disabled={!w.times}
							onclick={() => w.times && onmove(w.times, 'whole', 'start')}>{w.label}</button
						>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-2 border-t border-(--pl-raised) px-4 pt-2.5 pb-5">
		<button type="button" class={BTN_DANGER} onclick={ondelete}>
			<Icon d={icons.trash} />Delete
		</button>
		<span class="flex-1"></span>
		{#if keys}
			<button type="button" class={BTN_GHOST} onclick={onrename}>Rename</button>
		{/if}
		<button
			type="button"
			class="{BTN_ACCENT} h-13 min-w-38 rounded-2xl text-[16px]"
			onclick={ondone}
		>
			<Icon d={icons.check} />Done
		</button>
	</div>
</div>

<style>
	.kbd {
		margin-left: 0.25rem;
		padding: 0 0.3rem;
		border: 1px solid var(--pl-tick);
		border-radius: 0.3rem;
		font: inherit;
		font-size: 10px;
	}
</style>
