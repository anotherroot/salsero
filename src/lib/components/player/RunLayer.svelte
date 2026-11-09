<!-- src/lib/components/player/RunLayer.svelte -->
<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import { clock } from '$lib/format';
	import { stageDigit } from '$lib/player/view';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import BandButton from '$lib/components/ui/BandButton.svelte';

	/*
	 * One full-screen layer of the run (one-player design): the Routine list,
	 * About, Voice, a figure's details. A band strip on top — ✕, the live count,
	 * the name and the time — and the content on the ground under it; Stop and
	 * Pause (the run bar, z-20) stay on top of it, on the desktop too. It holds a history entry like
	 * a sheet (`sheetStack`), so Back closes it, not the run, and a layer over a
	 * layer closes first. On the desktop it fills the 520 px column, the stage
	 * left untouched, and the strip has no count of its own (the stage shows it).
	 * Without a player (Setup) the strip has no count.
	 */
	interface Props {
		/** The layer's name for a screen reader ("About", "Routine"). */
		label: string;
		/** The strip's line: the run's or the figure's name. */
		title: string;
		/** Under the title, beside the time: "5 of 16". */
		place?: string;
		player: PlayerHandle | null;
		beats?: number[];
		counts?: number[];
		paused?: boolean;
		/** A song's count-off sections: the strip's count is a dash there. */
		quiet?: QuietRange[];
		/** A layer over another one draws over it. */
		over?: boolean;
		/** The close button's name. */
		closeLabel: string;
		onclose: () => void;
		/** The strip's right end (the routine's Follow / Still). */
		strip?: Snippet;
		children: Snippet;
	}

	let {
		label,
		title,
		place,
		player,
		beats = [],
		counts = [],
		paused = false,
		quiet = [],
		over = false,
		closeLabel,
		onclose,
		strip,
		children
	}: Props = $props();

	let box: HTMLDivElement | undefined = $state();
	let key: number | null = null;

	onMount(() => {
		key = sheetStack.open({
			tryLeave: (leave) => leave(),
			close: () => {
				key = null;
				onclose();
			}
		});
		void tick().then(() =>
			box?.querySelector<HTMLElement>('[data-focus="layer-close"]')?.focus({ preventScroll: true })
		);
		// The run ending (Stop, the song's end) unmounts this with its entry still open.
		return () => {
			if (key !== null) sheetStack.closedByOwner(key);
		};
	});

	function close() {
		if (key !== null) sheetStack.requestClose(key);
		else onclose();
	}

	/* The strip's own count: read every frame, like StageCount. */
	let count = $state<number | null>(null);
	let off = $state(false);
	let time = $state(0);
	$effect(() => {
		const p = player;
		if (!p) return;
		let frame = 0;
		const loop = () => {
			time = p.songTime();
			const i = beatIndexAt(beats, time);
			off = isQuiet(quiet, time);
			count = i >= 0 ? (counts[i] ?? null) : null;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div
	bind:this={box}
	class="run-layer fixed inset-0 flex flex-col bg-ground desk:inset-auto desk:top-(--band-row-h) desk:right-0 desk:bottom-0 desk:w-[520px] {over
		? 'z-[16]'
		: 'z-[15]'}"
	role="dialog"
	aria-label={label}
	tabindex="-1"
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
>
	<div
		class="flex flex-none items-center gap-2.5 bg-band pr-4 pb-10 pl-2.5 text-band-ink desk:pt-3"
		style="padding-top: calc(12px + var(--safe-top)); --focus-ring: var(--color-band-ink)"
	>
		<BandButton icon="close" label={closeLabel} onclick={close} focusKey="layer-close" />
		{#if player}
			<span
				class="w-9 flex-none text-center font-display text-[42px] leading-none font-extrabold tabular-nums desk:hidden"
				aria-hidden="true">{stageDigit(count, paused, off).text}</span
			>
		{/if}
		<span class="min-w-0 flex-1 text-[13px] leading-tight font-bold text-band-small tabular-nums">
			<span class="block truncate text-[16px] font-extrabold text-band-ink">{title}</span>
			{[place, player ? clock(time) : null].filter(Boolean).join(' · ')}
		</span>
		{#if strip}<div class="flex-none">{@render strip()}</div>{/if}
	</div>
	<!--
		The ground's rounded top is its own plain cap, not the scroller's corners:
		Android Chrome paints a rounded scroller's corners black once a video in
		it plays (the scroller becomes its own layer), over the band.
	-->
	<div class="relative -mt-7 h-7 flex-none rounded-t-[28px] bg-ground" aria-hidden="true"></div>
	<div class="relative min-h-0 flex-1 overflow-y-auto bg-ground px-4 pb-[112px]">
		{@render children()}
	</div>
</div>
