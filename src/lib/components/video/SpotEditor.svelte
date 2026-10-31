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
	import Icon from '$lib/components/ui/Icon.svelte';
	import { editorSub, linkEntry } from '$lib/video/chrome';
	import { KBD, playerButton } from './styles';
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

	const sub = $derived(editorSub(spot));
	const entry = $derived(linkEntry(spot.linkedTo, !!onlink, 'editor'));

	// The 36 px Loop pill sits in a 44 px button. The builders' own sizes, with
	// the flex and gap they set swapped out by .replace, never a class appended.
	const LOOP = $derived(playerButton(looping ? 'accent' : 'neutral', 'sm'));
	const STEP = playerButton('neutral', 'xl', 'tile').replace('flex-none', 'flex-1');
	const NOW = STEP.replace('flex-1', 'flex-[1.3] flex-col').replace('gap-2', 'gap-0');
	const WHOLE = playerButton('outline', 'md')
		.replace('flex-none', 'flex-1')
		.replace('px-3', 'px-1');
	const DELETE = playerButton('danger-text').replace('px-4', 'px-3');
	const RENAME = playerButton('ghost', 'md');
	const DONE = playerButton('accent', 'cta');

	function onDrag(e: 'start' | 'end', ms: number) {
		// Hundredths: the precision the times are shown in.
		const snapped = Math.round(ms / 10) * 10;
		const times = moveEdge(spot, e, snapped, durationS);
		if (times) onmove(times, 'drag', e);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if transport}
		<div class="flex h-[52px] flex-none items-center border-b border-surface bg-ground pr-2 pl-5">
			<span class="text-[16px] font-extrabold tabular-nums">{preciseTime(currentMs)}</span>
			<span class="flex-1"></span>
			<Transport {paused} size="compact" {ontoggle} onstep={() => {}} {ontenth} />
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-ground px-4 pt-3.5 pb-2">
		<div class="flex items-start gap-2">
			<button
				type="button"
				class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left"
				aria-label="Rename {spotLabel(spot)}"
				onclick={onrename}
			>
				<span class="flex items-center gap-2">
					<span class="truncate font-display text-[22px] leading-[1.15] font-extrabold"
						>{spotLabel(spot)}</span
					>
					<span class="flex text-muted"><Icon name="edit" size={16} /></span>
				</span>
				<span class="text-[13px] text-muted tabular-nums">{sub}</span>
			</button>
			{#if isSection}
				<button
					type="button"
					class="flex h-11 flex-none cursor-pointer items-center"
					aria-pressed={looping}
					onclick={onloop}
				>
					<span class={LOOP}>
						<Icon name="repeat" size={16} />{looping ? 'Looping' : 'Loop'}
					</span>
				</button>
			{/if}
		</div>
		{#if entry.kind === 'open'}
			<button
				type="button"
				class="-my-3 flex h-11 cursor-pointer items-center gap-1.5 self-start text-left text-[13px] {entry.invite
					? 'font-extrabold text-accent-text'
					: 'font-semibold text-ink-2'}"
				onclick={onlink}
			>
				<Icon name="link" size={15} />{entry.text}{#if !entry.invite}<span class="flex text-muted"
						><Icon name="chevron-right" size={16} /></span
					>{/if}
			</button>
		{:else if entry.kind === 'show'}
			<span
				class="-my-1.5 flex h-8 items-center gap-1.5 self-start text-[13px] font-semibold text-ink-2"
			>
				<Icon name="link" size={15} />{entry.text}
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
			<div class="flex flex-none gap-2">
				{#each ['start', 'end'] as const as e (e)}
					{@const on = edge === e}
					<button
						type="button"
						class="flex h-14 flex-1 cursor-pointer flex-col items-start justify-center gap-px rounded-[14px] px-3.5 {on
							? 'bg-raised shadow-[inset_0_0_0_2px_var(--color-accent)]'
							: 'bg-surface'}"
						aria-pressed={on}
						onclick={() => onselect(e)}
					>
						<span
							class="flex items-center gap-1 text-[12px] font-bold {on
								? 'text-accent-text'
								: 'text-muted'}"
						>
							{e === 'start' ? 'Start' : 'End'}
							{#if keys}<kbd class={KBD}>{e === 'start' ? 'I' : 'O'}</kbd>{/if}
						</span>
						<span class="text-[18px] font-extrabold tabular-nums"
							>{preciseTime(e === 'start' ? spot.startMs : (spot.endMs ?? 0))}</span
						>
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex flex-none flex-col gap-1.5">
			<span class="text-[12px] font-bold text-muted"
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
						class={STEP}
						disabled={!s.times}
						onclick={() => s.times && onmove(s.times, s.how, edge)}>{s.label}</button
					>
				{/each}
				<button
					type="button"
					class="{NOW} leading-tight"
					disabled={!now}
					onclick={() => now && onmove(now, 'now', edge)}
				>
					<span>Now</span>
					<span class="text-[12px] font-semibold {now ? 'text-muted' : 'text-disabled-ink'}"
						>{spotTime(currentMs)}</span
					>
				</button>
				{#each steps.slice(2) as s (s.label)}
					<button
						type="button"
						class={STEP}
						disabled={!s.times}
						onclick={() => s.times && onmove(s.times, s.how, edge)}>{s.label}</button
					>
				{/each}
			</div>
		</div>

		{#if isSection && spot.endMs !== null}
			<div class="flex flex-none flex-col gap-1.5">
				<span class="text-[12px] font-bold text-muted"
					>Whole section · {lengthText(spot.endMs - spot.startMs)}</span
				>
				<div class="flex gap-1.5">
					{#each whole as w (w.label)}
						<button
							type="button"
							class={WHOLE}
							disabled={!w.times}
							onclick={() => w.times && onmove(w.times, 'whole', 'start')}>{w.label}</button
						>
					{/each}
				</div>
			</div>
		{/if}
		{#if !keys}
			<div
				class="pointer-events-none sticky bottom-0 -mt-9 h-9 flex-none bg-linear-to-b from-transparent to-ground"
				aria-hidden="true"
			></div>
		{/if}
	</div>

	<div
		class="flex flex-none items-center gap-2 border-t border-surface bg-ground px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),22px)]"
	>
		<button type="button" class={DELETE} onclick={ondelete}>
			<Icon name="trash" size={20} />Delete
		</button>
		<span class="flex-1"></span>
		{#if keys}
			<button type="button" class={RENAME} onclick={onrename}>Rename</button>
		{/if}
		<button type="button" class={DONE} onclick={ondone}>
			<Icon name="check" size={20} />Done
		</button>
	</div>
</div>
